# Bila UiTM Cuti API — Full Reference

Base URL: `https://api.bilauitmcuti.com`
All endpoints below are relative to that base URL. All methods are `GET`. No authentication required.

Source of truth: `https://api.bilauitmcuti.com/api/openapi.json` (OpenAPI 3 spec — import into Postman/Insomnia/Hoppscotch, or generate a typed client with [OpenAPI Generator](https://openapi-generator.tech/docs/installation)). Human-readable docs: `https://api.bilauitmcuti.com/docs`.

## Table of contents

- [Conventions](#conventions)
- [Academic Calendar](#academic-calendar)
  - [`GET /api/v1/meta`](#get-apiv1meta)
  - [`GET /api/v1/calendar`](#get-apiv1calendar)
  - [`GET /api/v1/today`](#get-apiv1today)
  - [`GET /api/v1/lecture-weeks`](#get-apiv1lecture-weeks)
- [Malaysia Public Holiday](#malaysia-public-holiday)
  - [`GET /api/v1/public-holiday/meta`](#get-apiv1public-holidaymeta)
  - [`GET /api/v1/public-holiday`](#get-apiv1public-holiday)
- [Errors](#errors)
- [Rate limits & caching](#rate-limits--caching)

---

## Conventions

- Boolean-ish query params (`all`, `allSessions`) accept `"true"`, `"1"`, or `"yes"`.
- `group` is always `"A"` or `"B"` (UiTM Group A / Group B academic schedules).
- Session IDs follow the pattern `<Group>-<sessionCode>`, e.g. `A-20251`, `B-20263`. Session IDs are returned by `GET /api/v1/meta`; do not hardcode or guess them.
- State/territory filters for holidays are lowercase slugs, not display labels.

---

## Academic Calendar

### `GET /api/v1/meta`

Sessions & programs (meta). Returns session and program options used by calendar queries, including the default session.

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `all` | string | When `true`/`1`/`yes`, returns metadata for **all** groups, ignoring `group`. Legacy alias: `entire`. |
| `group` | string | Limit options to one group: `"A"` or `"B"`. |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `apiVersion` | string | API version, e.g. `"1"`. |
| `baseUrl` | string | `https://api.bilauitmcuti.com` |
| `all` | boolean | Present when `all=true` was requested. |
| `defaultSession` | object \| string | When `all=true`: `{ "A": "<sessionId>", "B": "<sessionId>" }`. When `group=A\|B`: a single session id string for that group (e.g. `"B-20264"`). |
| `sessionOptions` | object[] | `{ id, label, group }[]`, e.g. `{ "id": "A-20251", "label": "Sesi 1 2025", "group": "A" }` |
| `programOptions` | object[] | `{ label, value, group }[]`, e.g. `{ "label": "Diploma", "value": "Diploma", "group": "B" }` |

**Example**

```bash
curl -sS "https://api.bilauitmcuti.com/api/v1/meta?group=B"
```

---

### `GET /api/v1/calendar`

Calendar activity rows for one session, or aggregated across a group.

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `all` | string | Full dataset (all sessions, defaults, options, activities). Legacy alias: `entire`. |
| `session` | string | Session id from `meta`. Omit to aggregate all sessions in `group`. |
| `group` | string | `"A"` or `"B"`. |
| `allSessions` | string | When truthy, returns activities for every session in the selected `group`. |
| `program` | string | Program filter, mainly for Group B, e.g. `"Diploma"`. |
| `type` | string | Activity type: `lecture`, `break`, `examination`, `registration`, `other`. |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `apiVersion` / `baseUrl` | string | As above. |
| `all` | boolean | Present in full-dataset mode. |
| `defaultSession` | object \| string | Present in full-dataset mode as `{ A, B }` map; may be a string when scoped by `group`. |
| `sessionOptions` / `programOptions` | array | Present in full-dataset mode. |
| `sessions` | array\|object | Session→activities map, shape depends on mode: `{ "A-20251": { "activities": [] } }` |
| `allSessions` | boolean | Present in grouped multi-session mode. |
| `group` | string | Resolved group key for grouped responses. |
| `session` | object | Resolved session metadata for single-session responses. |
| `filters` | object | Applied filters echoed back, e.g. `{ "program": "Diploma", "type": "break" }` |
| `activities` | array | Rows, e.g. `{ "week": 1, "activity": "Lecture Week", "type": "lecture" }` |
| `meta` | object | Counters, e.g. `{ "totalInSession": 48, "returned": 12 }` |

**Example**

```bash
curl -sS "https://api.bilauitmcuti.com/api/v1/calendar?session=B-20263&group=B&program=Diploma&type=break"
```

**404 case**: an unknown/missing `session` bucket returns `404`.

---

### `GET /api/v1/today`

What's happening on a given date: class day, break, exam week, or study week.

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `group` | string | **Required.** `"A"` or `"B"` — used first for session resolution. |
| `date` | string | ISO date, e.g. `2026-03-09`. Defaults to today. |
| `session` | string | Session id. Omit to aggregate all sessions in `group`. |
| `program` | string | Mainly for Group B sessions. |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `apiVersion` / `baseUrl` | string | As above. |
| `date` | string | Resolved ISO date. |
| `sessionResolved` | object | `{ id, label, group }` |
| `filters` | object | `{ program }` |
| `statuses` | string[] | All matched statuses for the day, e.g. `["exam_week"]`. |
| `primaryStatus` | string | Highest-priority status for quick display, e.g. `"exam_week"`. |
| `matchedActivities` | object[] | Activities active that date: `{ name, startDate, endDate, type, group }` |

**Example**

```bash
curl -sS "https://api.bilauitmcuti.com/api/v1/today?group=B&date=2026-03-09&session=B-20263&program=Diploma"
```

---

### `GET /api/v1/lecture-weeks`

Up to 14 instructional weeks for a session. Each week is a Mon–Sun slot with **break days already removed** from `days`; weeks that are entirely break are skipped from the response.

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `session` | string | **Required.** Session id from `meta.sessionOptions`. |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `apiVersion` / `baseUrl` | string | As above. |
| `session` | object | `{ id, label, group }` |
| `limit` | integer | Max weeks returned (currently `14`). |
| `weeks` | object[] | `{ weekNumber, weekStart, weekEnd, rangeLabel, days: [{ date, weekday, label }] }` |
| `meta` | object | `{ weekCount, firstLectureDate, lastLectureDate }` |

**Example**

```bash
curl -sS "https://api.bilauitmcuti.com/api/v1/lecture-weeks?session=B-20263"
```

**404 case**: unknown `session` returns `404`.

---

## Malaysia Public Holiday

### `GET /api/v1/public-holiday/meta`

Filter option metadata: available years, coverage modes, states/territories list.

No query parameters.

**Response fields**

| Field | Type | Description |
|---|---|---|
| `apiVersion` / `baseUrl` | string | As above. |
| `defaultYear` | integer | e.g. `2026` |
| `yearOptions` | object[] | `{ value, label }[]` |
| `coverageOptions` | object[] | `{ value: "all"\|"nationwide", label }[]` |
| `stateOptions` | object[] | `{ value: <slug>, label }[]` — full 16-territory list |

**Example**

```bash
curl -sS "https://api.bilauitmcuti.com/api/v1/public-holiday/meta"
```

---

### `GET /api/v1/public-holiday`

Malaysia public holiday rows, filterable.

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `year` | integer | Must be in `yearOptions`. Omit to use `defaultYear`. |
| `coverage` | string | `"all"` returns every row (ignores `state`). `"nationwide"` returns only rows where `states` lists all 16 territories. Omit to use `state` filtering instead. |
| `state` | string | Slug filter. With `state` set, returns nationwide rows **plus** rows covering that state. Accepted slugs: `johor`, `kedah`, `kelantan`, `melaka`, `negeri-sembilan`, `pahang`, `perak`, `perlis`, `pulau-pinang`, `sabah`, `sarawak`, `selangor`, `terengganu`, `kuala-lumpur`, `labuan`, `putrajaya`. Ignored when `coverage=all`. |

**Response fields**

| Field | Type | Description |
|---|---|---|
| `apiVersion` / `baseUrl` | string | As above. |
| `defaultYear` | integer | As above. |
| `yearOptions` | object[] | As above. |
| `query` | object | Echoed filters: `{ year, state, coverage }` |
| `total` | integer | Row count after filtering. |
| `meta` | object | `{ nationwideTotal, dateRange: { startDate, endDate }, stateTotals: [{ state, label, total }] }` |
| `holidays` | object[] | `{ id, name, date, day, states: string[], isSubjectToChange }` — nationwide rows list all 16 slugs; others list only applicable ones |

**Example**

```bash
curl -sS "https://api.bilauitmcuti.com/api/v1/public-holiday?year=2026&state=selangor"
```

---

## Errors

| Status | Meaning |
|---|---|
| `400` | Invalid query parameter. Body includes an `error` field describing what's wrong. |
| `404` | Missing calendar/lecture-week session bucket (`/api/v1/calendar`, `/api/v1/lecture-weeks` only). |
| `429` | Rate limited. Respect the `Retry-After` header and back off. |

Non-2xx responses should be handled before parsing JSON — don't assume every response is a `200`.

## Rate limits & caching

- Rate limits are applied per-IP when configured. Expect `429` with a `Retry-After` header under heavy polling.
- Responses support `ETag` + `Cache-Control`. Send `If-None-Match: <etag>` on repeat requests to get a `304 Not Modified` (no body) and avoid unnecessary payload transfer — especially useful for cron jobs, Discord/Telegram bots, or Workers routes that poll on a schedule.
- This is a free, hobby-scale, unofficial API — build in caching and backoff rather than polling aggressively.

interface PageSeoBreadcrumb {
  name: string;
  item: string;
}

interface PageSeoBlockProps {
  heading: string;
  description: string;
  url: string;
  breadcrumbs?: PageSeoBreadcrumb[];
}

export function PageSeoBlock({ heading, description, url, breadcrumbs }: PageSeoBlockProps) {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebPage',
      name: heading,
      url,
      description,
      isPartOf: { '@type': 'WebSite', name: 'Bila UiTM Cuti', url: 'https://bilauitmcuti.com' },
    },
  ];

  if (breadcrumbs && breadcrumbs.length > 0) {
    graph.unshift({
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.item,
      })),
    });
  }

  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });

  return (
    <section className="sr-only" aria-label="Ringkasan halaman">
      <h1>{heading}</h1>
      <p>{description}</p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </section>
  );
}

export const groupMediaByDateAndRow = (mediaList, dateExtractor) => {
  if (!mediaList || mediaList.length === 0) return [];

  const groupedByDate = mediaList.reduce((acc, item) => {
    const date = dateExtractor(item);
    if (!date) return acc;

    const d = new Date(date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(d.getDate()).padStart(2, '0')}`;

    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  // --- PERFORMANCE FIX: Group items into rows of 3 for SectionList virtualization ---
  for (const dateKey in groupedByDate) {
    const items = groupedByDate[dateKey];
    const rows = [];
    for (let i = 0; i < items.length; i += 3) {
      rows.push(items.slice(i, i + 3));
    }
    groupedByDate[dateKey] = rows;
  }

  return Object.keys(groupedByDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .map(dateKey => ({
      title: new Date(dateKey).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      data: groupedByDate[dateKey], // Now data is an array of rows
    }));
};

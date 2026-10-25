import baseline from '../../../docs/redesign/parity.json';
export interface Requirement {
  id: string;
  title: string;
  category: string;
  status: string;
  sources: string[];
  acceptance: string[];
  baselineTests: string[];
}
export const requirements: Requirement[] = baseline.requirements;
export const categories = [
  'All',
  ...new Set(requirements.map((item) => item.category)),
];
export function filterRequirements(query: string, category: string) {
  const text = query.trim().toLocaleLowerCase();
  return requirements.filter(
    (item) =>
      (category === 'All' || item.category === category) &&
      `${item.id} ${item.title} ${item.category}`
        .toLocaleLowerCase()
        .includes(text),
  );
}

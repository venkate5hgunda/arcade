// Icon names are fixed catalog/UI constants, never user-provided text.
export function iconMarkup(name, className = 'ui-glyph') {
  const [collection, icon] = name.split(':');
  return `<span class="${className}" aria-hidden="true" style="--icon-url:url('../assets/icons/${collection}/${icon}.svg')"></span>`;
}

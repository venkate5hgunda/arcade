import type { BoardOptions } from '../lib/catan-core.js';
export function IslandOptions({
  options,
  setOptions,
  ports,
  setPorts,
}: {
  options: BoardOptions;
  setOptions: (value: BoardOptions) => void;
  ports: 'fixed' | 'shuffled';
  setPorts: (value: 'fixed' | 'shuffled') => void;
}) {
  return (
    <fieldset>
      <legend>Island options</legend>
      <label>
        Harbors
        <select
          value={ports}
          onChange={(e) => setPorts(e.target.value as 'fixed' | 'shuffled')}
        >
          <option value="fixed">Classic positions</option>
          <option value="shuffled">Changing positions</option>
        </select>
      </label>
      <label>
        Island style
        <select
          value={options.imageStyle}
          onChange={(e) =>
            setOptions({
              ...options,
              imageStyle: e.target.value as BoardOptions['imageStyle'],
            })
          }
        >
          <option value="illustrated">Illustrated</option>
          <option value="colorblock">Colorblock</option>
        </select>
      </label>
      {(
        [
          ['hotTouch', '6 & 8 can touch'],
          ['coldTouch', '2 & 12 can touch'],
          ['sameNumberTouch', 'Same numbers can touch'],
          ['sameResourceTouch', 'Same land types can touch'],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={options[key]}
            onChange={(e) =>
              setOptions({ ...options, [key]: e.target.checked })
            }
          />{' '}
          {label}
        </label>
      ))}
    </fieldset>
  );
}

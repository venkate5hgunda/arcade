import type { BusinessOptions } from '../lib/business-core.js';
export function BusinessOptionsForm({
  options,
  onChange,
}: {
  options: BusinessOptions;
  onChange: (value: BusinessOptions) => void;
}) {
  const toggles: [keyof BusinessOptions, string, string][] = [
    ['rollToStart', 'Opening roll', 'Roll 12 to enter'],
    ['auctionOnly', 'Unowned deeds', 'Auction every deed'],
    ['jackpot', 'Rest Stop', 'Fines jackpot'],
    ['exactStartBonus', 'Exact Start', 'Extra salary'],
  ];
  return (
    <fieldset className="business-options">
      <legend>House rules</legend>
      <label>
        Game length
        <select
          value={options.turnLimit}
          onChange={(e) =>
            onChange({ ...options, turnLimit: Number(e.target.value) })
          }
        >
          {[0, 30, 60, 120].map((n) => (
            <option value={n} key={n}>
              {n === 0 ? 'Last player standing' : `${n} turns`}
            </option>
          ))}
        </select>
      </label>
      {toggles.map(([key, label, choice]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={!!options[key]}
            onChange={(e) => onChange({ ...options, [key]: e.target.checked })}
          />{' '}
          {label}: {choice}
        </label>
      ))}
      <label>
        Income tax
        <select
          value={options.incomeTax}
          onChange={(e) =>
            onChange({ ...options, incomeTax: Number(e.target.value) })
          }
        >
          <option value={200}>₹200</option>
          <option value={2000}>₹2,000</option>
        </select>
      </label>
      <label>
        Jail fine
        <select
          value={options.jailFine}
          onChange={(e) =>
            onChange({ ...options, jailFine: Number(e.target.value) })
          }
        >
          <option value={200}>₹200</option>
          <option value={500}>₹500</option>
        </select>
      </label>
    </fieldset>
  );
}

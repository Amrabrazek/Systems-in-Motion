import type { NumberEntry } from '../../engine';
import { tagNames, tagTooltip } from './tags';

/** A number in mono with its M / R / T / U tag beside it (design system part 6). */
export function NumberTag({ entry, children }: { entry: NumberEntry; children?: React.ReactNode }) {
  return (
    <span className="number">
      <span className="number-value">{children ?? `${entry.value} ${entry.unit}`}</span>
      <abbr
        className={`tag tag--${entry.tag}`}
        title={tagTooltip(entry)}
        aria-label={`${tagNames[entry.tag]}. ${entry.note}`}
        tabIndex={0}
      >
        {entry.tag}
      </abbr>
    </span>
  );
}

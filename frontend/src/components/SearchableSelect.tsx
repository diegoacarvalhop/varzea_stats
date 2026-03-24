import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import pageShared from '@/styles/pageShared.module.scss';
import cls from './SearchableSelect.module.scss';

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Rótulo de seção (ex.: nome da equipe) */
  group?: string;
};

type EmptyOption = { value: string; label: string };

export type SearchableSelectProps = {
  id: string;
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Primeira linha (ex.: “Nenhum”, placeholder de escolha) */
  emptyOption?: EmptyOption;
  /** Texto do botão quando não há valor selecionado (e sem emptyOption ou value vazio) */
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Nome do campo: inclui input hidden para o navegador validar formulário com `required`. */
  formValueName?: string;
  className?: string;
  style?: CSSProperties;
  /** aria-label no combobox (quando não há label visível) */
  'aria-label'?: string;
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function matchesQuery(query: string, label: string, group?: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const nq = normalize(q);
  if (normalize(label).includes(nq)) return true;
  if (group && normalize(group).includes(nq)) return true;
  return false;
}

export function SearchableSelect({
  id,
  label,
  value,
  onChange,
  options,
  emptyOption,
  placeholder,
  disabled = false,
  required = false,
  formValueName,
  className,
  style,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const [dropdownPlacement, setDropdownPlacement] = useState<'down' | 'up'>('down');
  const [listMaxHeight, setListMaxHeight] = useState(280);

  const filteredOptions = useMemo(() => {
    return options.filter((o) => matchesQuery(query, o.label, o.group));
  }, [options, query]);

  const showEmptyRow = useMemo(() => {
    if (!emptyOption) return false;
    return matchesQuery(query, emptyOption.label);
  }, [emptyOption, query]);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      const target = ev.target as Node;
      const clickedRoot = rootRef.current?.contains(target) ?? false;
      const clickedDropdown = dropdownRef.current?.contains(target) ?? false;
      if (!clickedRoot && !clickedDropdown) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    function updatePos() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
      const availableForList = Math.max(120, (openUpward ? spaceAbove : spaceBelow) - 56);
      setDropdownPos({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
      setDropdownPlacement(openUpward ? 'up' : 'down');
      setListMaxHeight(Math.min(360, availableForList));
    }
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  const selectedLabel = useMemo(() => {
    if (emptyOption && value === emptyOption.value) {
      return emptyOption.label;
    }
    const o = options.find((x) => x.value === value);
    return o?.label ?? '';
  }, [value, options, emptyOption]);

  const displayTrigger = selectedLabel || placeholder || 'Selecione…';

  function handleSelect(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={`${pageShared.field} ${className ?? ''}`} style={style} ref={rootRef}>
      {label != null && (
        <label className={pageShared.fieldLabel} htmlFor={id}>
          {label}
        </label>
      )}
      <div className={cls.wrap}>
        {formValueName != null && (
          <input type="hidden" name={formValueName} value={value} required={required} tabIndex={-1} aria-hidden="true" />
        )}
        <button
          type="button"
          id={id}
          ref={triggerRef}
          className={`${pageShared.select} ${cls.trigger}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-required={required}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setOpen((o) => !o);
              if (!open) setQuery('');
            }
          }}
        >
          <span className={cls.triggerText}>{displayTrigger}</span>
          <span className={cls.chevron} aria-hidden>
            ▼
          </span>
        </button>
        {open &&
          !disabled &&
          createPortal(
            <div
              ref={dropdownRef}
              className={cls.dropdown}
              style={{
                position: 'fixed',
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 9999,
                top: dropdownPlacement === 'down' ? dropdownPos.top : undefined,
                bottom: dropdownPlacement === 'up' ? window.innerHeight - dropdownPos.top : undefined,
              }}
            >
              <input
                type="search"
                className={cls.filter}
                placeholder="Buscar…"
                value={query}
                autoComplete="off"
                autoFocus
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setQuery('');
                  }
                }}
                aria-label="Filtrar opções"
              />
              <ul id={listId} role="listbox" className={cls.list} style={{ maxHeight: `${listMaxHeight}px` }}>
                {showEmptyRow && emptyOption && (
                  <li key="__empty" role="presentation">
                    <button
                      type="button"
                      role="option"
                      className={cls.option}
                      aria-selected={value === emptyOption.value}
                      onClick={() => handleSelect(emptyOption.value)}
                    >
                      {emptyOption.label}
                    </button>
                  </li>
                )}
                {filteredOptions.map((o, idx) => {
                  const prev = filteredOptions[idx - 1];
                  const showGroupHeader = Boolean(o.group && o.group !== prev?.group);
                  return (
                    <Fragment key={o.value}>
                      {showGroupHeader && (
                        <li className={cls.groupLabel} role="presentation">
                          {o.group}
                        </li>
                      )}
                      <li role="presentation">
                        <button
                          type="button"
                          role="option"
                          className={cls.option}
                          aria-selected={value === o.value}
                          onClick={() => handleSelect(o.value)}
                        >
                          {o.label}
                        </button>
                      </li>
                    </Fragment>
                  );
                })}
                {!showEmptyRow && filteredOptions.length === 0 && (
                  <li className={cls.emptyHint} role="presentation">
                    Nenhum resultado.
                  </li>
                )}
              </ul>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}

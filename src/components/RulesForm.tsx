import { type DulleRule, type RuleSettings, SOLO_NAMES, SOLO_TYPES } from '@engine';
import type { ReactNode } from 'react';

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-lg px-2 py-1.5 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-white/5'}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-white/20 transition peer-checked:bg-gold-400 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-300
          after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4"
      />
      <span className="text-sm">
        <span className="font-medium text-white">{label}</span>
        {hint && <span className="block text-xs text-white/55">{hint}</span>}
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-xs font-semibold tracking-wider text-gold-300/90 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

const DULLE_OPTIONS: { value: DulleRule; label: string }[] = [
  { value: 'first', label: 'Erste Dulle gewinnt' },
  { value: 'second', label: 'Zweite Dulle gewinnt' },
  { value: 'secondInLastTrick', label: 'Zweite Dulle gewinnt nur im letzten Stich' },
];

export function RulesForm({
  value,
  onChange,
  disabled,
  narrow,
}: {
  value: RuleSettings;
  onChange: (s: RuleSettings) => void;
  disabled?: boolean;
  /** Immer einspaltig (Seitenleiste) */
  narrow?: boolean;
}) {
  const set = <K extends keyof RuleSettings>(key: K, v: RuleSettings[K]) => onChange({ ...value, [key]: v });

  return (
    <div className={`grid gap-5 ${narrow ? '' : 'sm:grid-cols-2'}`}>
      <Section title="Grundregeln">
        <Toggle
          label="Mit Neunen"
          hint={value.withNines ? '48 Karten, 12 pro Spieler' : '40 Karten, 10 pro Spieler'}
          checked={value.withNines}
          onChange={(v) => set('withNines', v)}
          disabled={disabled}
        />
        <Toggle
          label="Ansagen"
          hint="Re/Kontra, keine 90, 60, 30, schwarz"
          checked={value.announcements}
          onChange={(v) => set('announcements', v)}
          disabled={disabled}
        />
        <div className="px-2 pt-2">
          <label className="label" htmlFor="dulle">
            Zwei Herz-Zehnen im Stich
          </label>
          <select
            id="dulle"
            className="input py-2"
            value={value.dulleRule}
            disabled={disabled}
            onChange={(e) => set('dulleRule', e.target.value as DulleRule)}
          >
            {DULLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Sonderpunkte">
        <Toggle
          label="Doppelkopf"
          hint="Stich mit 40 oder mehr Augen"
          checked={value.doppelkopf}
          onChange={(v) => set('doppelkopf', v)}
          disabled={disabled}
        />
        <Toggle
          label="Fuchs gefangen"
          hint="Karo-As des Gegners gefangen"
          checked={value.fuchs}
          onChange={(v) => set('fuchs', v)}
          disabled={disabled}
        />
        <Toggle
          label="Karlchen"
          hint="Letzter Stich mit dem Kreuz-Buben"
          checked={value.karlchen}
          onChange={(v) => set('karlchen', v)}
          disabled={disabled}
        />
        <Toggle
          label="Schweinchen"
          hint="Beide Karo-Asse auf einer Hand sind höchster Trumpf"
          checked={value.schweinchen}
          onChange={(v) => set('schweinchen', v)}
          disabled={disabled}
        />
      </Section>

      <Section title="Soli">
        {SOLO_TYPES.map((t) => (
          <Toggle
            key={t}
            label={SOLO_NAMES[t]}
            checked={value.soli[t]}
            onChange={(v) => set('soli', { ...value.soli, [t]: v })}
            disabled={disabled}
          />
        ))}
      </Section>

      <Section title="Vorbehalte">
        <Toggle label="Hochzeit" hint="Immer erlaubt" checked onChange={() => {}} disabled />
        <Toggle
          label="Armut"
          hint="Bei genau 3 Trümpfen: Trümpfe abgeben"
          checked={value.armut}
          onChange={(v) => set('armut', v)}
          disabled={disabled}
        />
        <p className="px-2 pt-2 text-xs font-medium text-white/60">Schmeißen erlaubt bei …</p>
        <Toggle
          label="mehr als 80 Augen"
          checked={value.schmeissen.over80}
          onChange={(v) => set('schmeissen', { ...value.schmeissen, over80: v })}
          disabled={disabled}
        />
        <Toggle
          label="5 Königen"
          checked={value.schmeissen.fiveKings}
          onChange={(v) => set('schmeissen', { ...value.schmeissen, fiveKings: v })}
          disabled={disabled}
        />
        <Toggle
          label="weniger als 3 Trümpfen"
          checked={value.schmeissen.fewTrumps}
          onChange={(v) => set('schmeissen', { ...value.schmeissen, fewTrumps: v })}
          disabled={disabled}
        />
        <Toggle
          label="5 Neunen"
          hint="Nur mit Neunen"
          checked={value.schmeissen.fiveNines}
          onChange={(v) => set('schmeissen', { ...value.schmeissen, fiveNines: v })}
          disabled={disabled || !value.withNines}
        />
      </Section>
    </div>
  );
}

/** Kurze Zusammenfassung der Regeln für die Lobby. */
export function rulesSummary(s: RuleSettings): string[] {
  const out = [s.withNines ? 'Mit Neunen' : 'Ohne Neunen'];
  out.push(DULLE_OPTIONS.find((o) => o.value === s.dulleRule)!.label);
  const extras = [
    s.doppelkopf && 'Doppelkopf',
    s.fuchs && 'Fuchs',
    s.karlchen && 'Karlchen',
    s.schweinchen && 'Schweinchen',
  ].filter(Boolean);
  if (extras.length) out.push(`Sonderpunkte: ${extras.join(', ')}`);
  if (!s.announcements) out.push('Keine Ansagen');
  const soli = SOLO_TYPES.filter((t) => s.soli[t]);
  out.push(soli.length === SOLO_TYPES.length ? 'Alle Soli' : soli.length ? `Soli: ${soli.map((t) => SOLO_NAMES[t]).join(', ')}` : 'Keine Soli');
  if (s.armut) out.push('Armut');
  return out;
}

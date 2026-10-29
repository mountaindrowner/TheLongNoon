/**
 * Scripts, as the first version wrote them (legacy/poc2 12-dialogue.js and
 * data/dialogue.json). A script is a list of lines and commands:
 *   ["Speaker", "Text"]   a line (an empty speaker is narration)
 *   { "do": "…", … }      a command (`Commands` says what each does)
 * A dialogue entry is either one script, or scripts keyed by a condition
 * that's tried in order: `home&!fed` means "the step is home, and the flag
 * fed isn't set"; `*` is the fallback.
 */

export type Line = [string, string];
export interface Cmd { do: string; [k: string]: unknown }
export type Script = Array<Line | Cmd>;
export type Dialogue = Record<string, Script | Record<string, Script>>;

/** What a running script can do to the world. The game supplies these. */
export interface Stage {
  say(name: string, text: string): Promise<void>;
  choose(q: string, opts: string[]): Promise<number>;
  endTalk(): void;
  /** Every command but `choice`, which the director runs itself. */
  command(c: Cmd): Promise<void>;
  /** Stop the running script (a skipped tale). */
  aborted(): boolean;
}

export class Director {
  private depth = 0;
  /** `cond` reads a condition key (game/progress.ts: steps, nights, items, white, flags). */
  constructor(private readonly dlg: Dialogue, readonly cond: (key: string) => boolean, private readonly stage: Stage) {}

  get running(): boolean { return this.depth > 0; }

  /** The script an id resolves to now, or null. */
  resolve(id: string): Script | null {
    const d = this.dlg[id];
    if (!d) return null;
    if (Array.isArray(d)) return d;
    for (const k of Object.keys(d)) if (k !== '*' && this.cond(k)) return d[k]!;
    return d['*'] ?? null;
  }

  async run(lines: Script | null): Promise<void> {
    if (!lines) return;
    this.depth++;
    try {
      for (const l of lines) {
        if (this.stage.aborted()) break;
        if (Array.isArray(l)) await this.stage.say(l[0], l[1]);
        else if (l.do === 'choice') {
          const opts = l.opts as Array<[string, Script]>;
          const i = await this.stage.choose(l.q as string, opts.map((o) => o[0]));
          await this.run(opts[i]![1]);
        } else await this.stage.command(l);
      }
    } finally {
      this.depth--;
      if (this.depth === 0) this.stage.endTalk();
    }
  }
}

// Texts of `/home/faq`; `de` has to provide every key of `en`. A body entry is a paragraph, an array a bullet list.
// An entry's `id` is its anchor, which links point at (the animation toggle's hint links to `animations`).

export type FaqEntry = { id: string; question: string; body: (string | string[])[] };

const en = {
  lang: 'en',
  title: 'Questions and answers',
  back: 'Back to ftree',
  switchLanguage: 'Deutsch',
  switchTo: 'de',
  entries: [
    {
      id: 'animations',
      question: 'Why does nothing move in TRON?',
      body: [
        'The TRON animations (the running grid, the light tree, the ride into your tree) are off until you switch them on with "Animation", left of 3D | TRON at the top.',
        'If they are on and still nothing moves, your system asks apps to reduce motion, and ftree follows that. To see the animations, allow motion in your system settings and reload the page:',
        [
          'macOS: System Settings → Accessibility → Display → turn off "Reduce motion".',
          'Windows 11: Settings → Accessibility → Visual effects → turn on "Animation effects". Windows 10: Settings → Ease of Access → Display → turn on "Show animations in Windows".',
          'iPhone and iPad: Settings → Accessibility → Motion → turn off "Reduce Motion".',
          'Android: Settings → Accessibility → Color and motion → turn off "Remove animations" (the names vary by manufacturer).',
          'Linux (GNOME): Settings → Accessibility → turn on "Animation effects" (in older versions under Seeing).',
        ],
        'On company computers and in remote desktop sessions, animations are often switched off for you; there the setting may be locked.',
      ],
    },
  ] as FaqEntry[],
};

const de: typeof en = {
  lang: 'de',
  title: 'Fragen und Antworten',
  back: 'Zurück zu ftree',
  switchLanguage: 'English',
  switchTo: 'en',
  entries: [
    {
      id: 'animations',
      question: 'Warum bewegt sich in TRON nichts?',
      body: [
        'Die TRON-Animationen (das laufende Gitter, der Lichtbaum, die Fahrt in deinen Baum) sind aus, bis du sie oben mit „Animation“ (links neben 3D | TRON) einschaltest.',
        'Sind sie an und es bewegt sich trotzdem nichts, bittet dein System Apps, Bewegung zu reduzieren, und ftree hält sich daran. Damit du die Animationen siehst, erlaube Bewegung in deinen Systemeinstellungen und lade die Seite neu:',
        [
          'macOS: Systemeinstellungen → Bedienungshilfen → Anzeige → „Bewegung reduzieren“ ausschalten.',
          'Windows 11: Einstellungen → Barrierefreiheit → Visuelle Effekte → „Animationseffekte“ einschalten. Windows 10: Einstellungen → Erleichterte Bedienung → Anzeige → „Animationen in Windows anzeigen“ einschalten.',
          'iPhone und iPad: Einstellungen → Bedienungshilfen → Bewegung → „Bewegung reduzieren“ ausschalten.',
          'Android: Einstellungen → Bedienungshilfen → Farbe und Bewegung → „Animationen entfernen“ ausschalten (die Namen unterscheiden sich je nach Hersteller).',
          'Linux (GNOME): Einstellungen → Barrierefreiheit → „Animationseffekte“ einschalten (in älteren Versionen unter Sehen).',
        ],
        'Auf Firmenrechnern und in Remote-Desktop-Sitzungen sind Animationen oft vorab ausgeschaltet; dort lässt sich die Einstellung womöglich nicht ändern.',
      ],
    },
  ],
};

const TEXTS = { en, de };

// `?lang=en` shows English; anything else German, like the legal pages.
export const faqTexts = (lang: string | string[] | undefined) => (lang === 'en' ? TEXTS.en : TEXTS.de);

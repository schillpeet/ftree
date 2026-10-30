// Texts of `/terms` and `/privacy`; `de` has to provide every key of `en`, and only the German version is binding.
// A body entry is a paragraph, an array a bullet list. `op` is the operator from the server's environment.

type Operator = { name: string; email: string };
export type LegalSection = { heading: string; body: (string | string[])[] };

const en = {
  lang: 'en',
  back: 'Back to ftree',
  switchLanguage: 'Deutsch',
  switchTo: 'de',
  unset: 'not configured',
  binding: 'This translation is for information only; the German version is binding.',
  updated: 'As of 30 October 2026',
  terms: {
    title: 'Terms of use',
    sections: (op: Operator): LegalSection[] => [
      {
        heading: '1. Operator and scope',
        body: [
          `ftree is run privately and non-commercially by ${op.name} (${op.email}). These terms apply to everyone who uses ftree.`,
        ],
      },
      {
        heading: '2. Free test service, invitation only',
        body: [
          'ftree is a free test service (beta) for a closed group. Access is by personal invitation only; there is no right to access. Do not pass your access on to others.',
        ],
      },
      {
        heading: '3. Availability and data loss',
        body: [
          'There is no guarantee of availability. Features may change or disappear, the service may be interrupted or discontinued, and data may be lost despite backups. Export your trees regularly as GEDCOM files (download button on the family card). A discontinuation will be announced in advance where possible.',
        ],
      },
      {
        heading: '4. Your content',
        body: [
          'You are responsible for what you enter. Enter data about living persons only if you are entitled to, usually with their consent, and remove it when they ask you to. Upload photos only if you hold the rights to them and the people shown agree.',
          'You keep all rights to your content. You allow the operator to store it and show it to the people you share a tree with, as far as needed to run ftree.',
        ],
      },
      {
        heading: '5. Prohibited content and use',
        body: [
          'No illegal, insulting, or discriminatory content, nothing that infringes the rights of others, and no attacks on or misuse of the service.',
        ],
      },
      {
        heading: '6. Suspension and deletion',
        body: [
          'The operator may suspend accounts and delete content that violates these terms or the law, or when this is legally required. Where possible, you will be informed by email beforehand.',
        ],
      },
      {
        heading: '7. Liability',
        body: [
          'As ftree is provided free of charge, the operator is liable only for intent and gross negligence (as in §§ 521, 599 of the German Civil Code). This does not limit liability for injury to life, body, or health.',
        ],
      },
      {
        heading: '8. Changes',
        body: [
          'Changes to these terms are announced at least two weeks in advance by email or in the app. If you do not agree, you can stop using ftree and have your data deleted.',
        ],
      },
      {
        heading: '9. Applicable law',
        body: [
          'German law applies. Mandatory consumer protection rules of the country you live in remain unaffected.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    sections: (op: Operator): LegalSection[] => [
      {
        heading: '1. Controller',
        body: [
          `The controller is ${op.name}, email ${op.email}. ftree is run privately and non-commercially for a closed, invited test group.`,
        ],
      },
      {
        heading: '2. What data is processed',
        body: [
          [
            'Account: your email address, with which you were invited and sign in, your roles and rights in the trees, and email addresses others have been invited with.',
            'Sign-in and access: on every request Cloudflare and our server process technical data such as IP address, time, requested address, browser identification, and the result of the sign-in; Cloudflare also sends you the one-time PIN by email.',
            'Tree content: names, dates and places of birth and death, notes, photos, and relationships of the persons entered, including living persons who do not use ftree themselves; this data comes from the users who enter it.',
            'A change log records who changed what and when.',
          ],
        ],
      },
      {
        heading: '3. Purposes and legal bases',
        body: [
          [
            'Providing ftree to you (account, sign-in, storing and sharing your trees): Art. 6(1)(b) GDPR.',
            'Security, prevention of misuse, error analysis, logs, and backups: Art. 6(1)(f) GDPR; the legitimate interest is a secure and stable service without data loss.',
            'Data about living persons who do not use ftree: Art. 6(1)(f) GDPR (the users’ interest in shared family research) or the consent of the person concerned.',
          ],
        ],
      },
      {
        heading: '4. Recipients and processors',
        body: [
          [
            'Hetzner Online GmbH, Gunzenhausen, Germany: hosting of the server, the database, and the backups in data centres in Germany, as a processor (Art. 28 GDPR).',
            'Cloudflare, Inc., San Francisco, USA: sign-in (Cloudflare Access, including sending the PIN) and the encrypted connection (Cloudflare Tunnel), through which all requests pass, as a processor. Data may be transferred to the USA; Cloudflare is certified under the EU-US Data Privacy Framework (adequacy decision, Art. 45 GDPR).',
            'Other users: the people a tree is shared with see its content.',
          ],
          'Data is not sold or used for advertising.',
        ],
      },
      {
        heading: '5. Retention',
        body: [
          [
            'Account: until you ask for its deletion or your access ends.',
            'Trees: until they are deleted; a deleted tree stays in the trash for 30 days and is then removed for good.',
            'Logs and the change log: as long as needed for operation and security, at most for the duration of the test service.',
            'Backups: deleted data remains in backups for at most 30 days, until they are overwritten.',
          ],
        ],
      },
      {
        heading: '6. Your rights',
        body: [
          `You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20; you can export your trees as GEDCOM files at any time), and objection to processing based on Art. 6(1)(f) (Art. 21). Write to ${op.email}. You may also lodge a complaint with a data protection supervisory authority (Art. 77).`,
        ],
      },
      {
        heading: '7. Cookies and local storage',
        body: [
          'Only technically necessary storage is used: Cloudflare Access sets the cookie CF_Authorization to keep you signed in. Your browser’s local storage keeps your settings (language, appearance, card style, lines, and panel positions); they never leave your browser. There is no tracking, no analytics, and no advertising.',
        ],
      },
      {
        heading: '8. Data about other persons',
        body: [
          'Enter data about living persons only if you have a legal basis for it, usually their consent, and respect their objection. Deceased persons are not covered by the GDPR (Recital 27), but the rights of their living relatives remain.',
        ],
      },
    ],
  },
};

const de: typeof en = {
  lang: 'de',
  back: 'Zurück zu ftree',
  switchLanguage: 'English',
  switchTo: 'en',
  unset: 'nicht hinterlegt',
  binding: 'Maßgeblich ist diese deutsche Fassung.',
  updated: 'Stand: 30. Oktober 2026',
  terms: {
    title: 'Nutzungsbedingungen',
    sections: (op) => [
      {
        heading: '1. Betreiber und Geltung',
        body: [
          `ftree wird von ${op.name} (${op.email}) privat und nicht kommerziell betrieben. Diese Bedingungen gelten für alle, die ftree nutzen.`,
        ],
      },
      {
        heading: '2. Kostenloser Testbetrieb, nur auf Einladung',
        body: [
          'ftree ist ein kostenloser Testdienst (Beta) für einen geschlossenen Kreis. Zugang gibt es nur auf persönliche Einladung; ein Anspruch auf Zugang besteht nicht. Gib deinen Zugang nicht an andere weiter.',
        ],
      },
      {
        heading: '3. Verfügbarkeit und Datenverlust',
        body: [
          'Eine Verfügbarkeit wird nicht zugesagt. Funktionen können sich ändern oder entfallen, der Dienst kann unterbrochen oder eingestellt werden, und trotz Datensicherung können Daten verloren gehen. Exportiere deine Stammbäume regelmäßig als GEDCOM-Datei (Download-Knopf auf der Familienkarte). Eine Einstellung wird nach Möglichkeit vorher angekündigt.',
        ],
      },
      {
        heading: '4. Deine Inhalte',
        body: [
          'Für deine Eingaben bist du selbst verantwortlich. Trage Daten lebender Personen nur ein, wenn du dazu berechtigt bist, in der Regel mit deren Einwilligung, und entferne sie, wenn die Person es verlangt. Lade Fotos nur hoch, wenn du die Rechte daran hast und die abgebildeten Personen einverstanden sind.',
          'Alle Rechte an deinen Inhalten bleiben bei dir. Du erlaubst dem Betreiber, sie zu speichern und den Personen anzuzeigen, mit denen du einen Stammbaum teilst, soweit das für den Betrieb von ftree nötig ist.',
        ],
      },
      {
        heading: '5. Unzulässige Inhalte und Nutzung',
        body: [
          'Keine rechtswidrigen, beleidigenden oder diskriminierenden Inhalte, nichts, was Rechte anderer verletzt, und keine Angriffe auf den Dienst oder Missbrauch.',
        ],
      },
      {
        heading: '6. Sperrung und Löschung',
        body: [
          'Der Betreiber darf Konten sperren und Inhalte löschen, die gegen diese Bedingungen oder geltendes Recht verstoßen, oder wenn das rechtlich geboten ist. Nach Möglichkeit wirst du vorher per E-Mail informiert.',
        ],
      },
      {
        heading: '7. Haftung',
        body: [
          'Da ftree unentgeltlich bereitgestellt wird, haftet der Betreiber nur für Vorsatz und grobe Fahrlässigkeit (entsprechend §§ 521, 599 BGB). Die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit bleibt unberührt.',
        ],
      },
      {
        heading: '8. Änderungen',
        body: [
          'Änderungen dieser Bedingungen werden mindestens zwei Wochen vorher per E-Mail oder in der App angekündigt. Bist du nicht einverstanden, kannst du die Nutzung beenden und deine Daten löschen lassen.',
        ],
      },
      {
        heading: '9. Anwendbares Recht',
        body: [
          'Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften des Staates, in dem du lebst, bleiben unberührt.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Datenschutzhinweise',
    sections: (op) => [
      {
        heading: '1. Verantwortlicher',
        body: [
          `Verantwortlich ist ${op.name}, E-Mail ${op.email}. ftree wird privat und nicht kommerziell für einen geschlossenen, eingeladenen Testkreis betrieben.`,
        ],
      },
      {
        heading: '2. Welche Daten verarbeitet werden',
        body: [
          [
            'Konto: deine E-Mail-Adresse, mit der du eingeladen wurdest und dich anmeldest, deine Rollen und Rechte in den Stammbäumen sowie E-Mail-Adressen, für die Einladungen erstellt wurden.',
            'Anmeldung und Zugriff: Bei jedem Aufruf verarbeiten Cloudflare und unser Server technische Daten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browserkennung und das Ergebnis der Anmeldung; Cloudflare schickt dir außerdem den Einmal-PIN per E-Mail.',
            'Stammbauminhalte: Namen, Geburts- und Sterbedaten und -orte, Notizen, Fotos und Verwandtschaftsbeziehungen der eingetragenen Personen, auch lebender Personen, die ftree selbst nicht nutzen; diese Daten stammen von den Nutzern, die sie eintragen.',
            'Ein Änderungsprotokoll hält fest, wer wann was geändert hat.',
          ],
        ],
      },
      {
        heading: '3. Zwecke und Rechtsgrundlagen',
        body: [
          [
            'Bereitstellung von ftree für dich (Konto, Anmeldung, Speichern und Teilen deiner Stammbäume): Art. 6 Abs. 1 lit. b DSGVO.',
            'Sicherheit, Missbrauchsabwehr, Fehleranalyse, Protokolle und Datensicherungen: Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse ist ein sicherer, stabiler Betrieb ohne Datenverlust.',
            'Daten lebender Personen, die ftree nicht selbst nutzen: Art. 6 Abs. 1 lit. f DSGVO (Interesse der Nutzer an gemeinsamer Familienforschung) oder die Einwilligung der betroffenen Person.',
          ],
        ],
      },
      {
        heading: '4. Empfänger und Auftragsverarbeiter',
        body: [
          [
            'Hetzner Online GmbH, Gunzenhausen, Deutschland: Hosting von Server, Datenbank und Datensicherungen in Rechenzentren in Deutschland, als Auftragsverarbeiter (Art. 28 DSGVO).',
            'Cloudflare, Inc., San Francisco, USA: Anmeldung (Cloudflare Access, einschließlich Versand des PINs) und verschlüsselte Verbindung (Cloudflare Tunnel), über die alle Aufrufe laufen, als Auftragsverarbeiter. Dabei können Daten in die USA übermittelt werden; Cloudflare ist nach dem EU-US Data Privacy Framework zertifiziert (Angemessenheitsbeschluss, Art. 45 DSGVO).',
            'Andere Nutzer: Personen, mit denen ein Stammbaum geteilt ist, sehen dessen Inhalte.',
          ],
          'Daten werden nicht verkauft und nicht für Werbung genutzt.',
        ],
      },
      {
        heading: '5. Speicherdauer',
        body: [
          [
            'Konto: bis du die Löschung verlangst oder dein Zugang endet.',
            'Stammbäume: bis sie gelöscht werden; ein gelöschter Stammbaum liegt 30 Tage im Papierkorb und wird dann endgültig entfernt.',
            'Protokolle und Änderungsprotokoll: solange es für Betrieb und Sicherheit nötig ist, höchstens für die Dauer des Testbetriebs.',
            'Datensicherungen: Gelöschte Daten bleiben höchstens 30 Tage in Datensicherungen enthalten, bis diese überschrieben werden.',
          ],
        ],
      },
      {
        heading: '6. Deine Rechte',
        body: [
          `Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20; deine Stammbäume kannst du jederzeit als GEDCOM-Datei exportieren) und Widerspruch gegen Verarbeitungen nach Art. 6 Abs. 1 lit. f (Art. 21). Schreib dazu an ${op.email}. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77).`,
        ],
      },
      {
        heading: '7. Cookies und lokaler Speicher',
        body: [
          'Es wird nur technisch Notwendiges gespeichert: Cloudflare Access setzt das Cookie CF_Authorization, damit du angemeldet bleibst. Der lokale Speicher deines Browsers merkt sich deine Einstellungen (Sprache, Darstellung, Kartenstil, Linien und Position von Panels); sie verlassen deinen Browser nicht. Es gibt kein Tracking, keine Analyse und keine Werbung.',
        ],
      },
      {
        heading: '8. Daten anderer Personen',
        body: [
          'Trage Daten lebender Personen nur ein, wenn es dafür eine Rechtsgrundlage gibt, in der Regel ihre Einwilligung, und beachte ihren Widerspruch. Verstorbene fallen nicht unter die DSGVO (Erwägungsgrund 27), die Rechte ihrer lebenden Angehörigen bleiben aber bestehen.',
        ],
      },
    ],
  },
};

const TEXTS = { en, de };

// `?lang=en` shows the English translation; anything else the binding German text.
export const legalTexts = (lang: string | string[] | undefined) => (lang === 'en' ? TEXTS.en : TEXTS.de);

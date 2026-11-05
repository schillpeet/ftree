-- Version 1 of the terms and the privacy notice, revised from the texts that used to live in the UI. They apply from the
-- moment this migration runs. A later version is a new migration; this one must not change once it has run anywhere.
INSERT INTO legal_documents (kind, version, effective_at, requires_action, body_de, body_en, content_sha256)
SELECT 'terms', 1, now(), true, body_de, body_en, encode(sha256(convert_to(body_de, 'UTF8')), 'hex')
FROM (VALUES ($de$## 1. Betreiber und Geltung

ftree wird von {{operator.name}} ({{operator.email}}) privat und nicht kommerziell betrieben. Diese Bedingungen gelten für alle, die ftree nutzen.

## 2. Kostenloser Testbetrieb, nur auf Einladung

ftree ist ein kostenloser Testdienst (Beta) für einen geschlossenen Kreis. Zugang gibt es nur auf persönliche Einladung; eine Registrierung und einen Anspruch auf Zugang gibt es nicht. Gib deinen Zugang nicht an andere weiter.

Du musst mindestens 16 Jahre alt sein, um ftree zu nutzen.

Es gelten Grenzen: Du kannst höchstens 5 Stammbäume besitzen, ein Stammbaum fasst höchstens 100 Personen, und insgesamt gibt es höchstens 50 Zugänge. Ist diese Grenze erreicht, kann niemand Neues eingeladen werden.

## 3. Verfügbarkeit und Datenverlust

Eine Verfügbarkeit wird nicht zugesagt. Funktionen können sich ändern oder entfallen, der Dienst kann unterbrochen oder eingestellt werden, und trotz Datensicherung können Daten verloren gehen; Datensicherungen entstehen einmal pro Nacht, die Änderungen von bis zu einem Tag können also verloren gehen. Exportiere deine Stammbäume regelmäßig als GEDCOM-Datei (Download-Knopf auf der Familienkarte); Fotos sind darin nicht enthalten. Eine Einstellung wird nach Möglichkeit vorher angekündigt.

## 4. Deine Inhalte

Für deine Eingaben bist du selbst verantwortlich. Trage Daten lebender Personen nur ein, wenn du dazu berechtigt bist, und entferne sie, wenn die Person es verlangt. Lade Fotos nur hoch, wenn du die Rechte daran hast und die abgebildeten Personen einverstanden sind.

Sei zurückhaltend mit Daten von Kindern: Trage von Minderjährigen nur ein, was für den Stammbaum nötig ist, und nur, wenn die Sorgeberechtigten einverstanden sind.

Schreibe keine besonders sensiblen Angaben über andere in Notizen, etwa zu Gesundheit, Religion, sexueller Orientierung oder politischer Überzeugung, es sei denn, die Person hat ausdrücklich eingewilligt oder die Angabe betrifft nur Verstorbene.

Alle Rechte an deinen Inhalten bleiben bei dir. Du erlaubst dem Betreiber, sie zu speichern und den Personen anzuzeigen, mit denen du einen Stammbaum teilst, soweit das für den Betrieb von ftree nötig ist.

## 5. Unzulässige Inhalte und Nutzung

Keine rechtswidrigen, beleidigenden oder diskriminierenden Inhalte, nichts, was Rechte anderer verletzt, und keine Angriffe auf den Dienst oder Missbrauch.

## 6. Entzug des Zugangs und Löschung

Der Betreiber darf dir den Zugang entziehen und dein Konto oder Inhalte löschen, wenn sie gegen diese Bedingungen oder geltendes Recht verstoßen oder wenn das rechtlich geboten ist. Nach Möglichkeit wirst du vorher per E-Mail informiert.

## 7. Haftung

Da ftree unentgeltlich bereitgestellt wird, haftet der Betreiber nur für Vorsatz und grobe Fahrlässigkeit (entsprechend §§ 521, 599 BGB). Die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit bleibt unberührt.

## 8. Änderungen

Änderungen dieser Bedingungen werden mindestens zwei Wochen vorher in der App angekündigt. Ab dem angekündigten Tag kannst du ftree erst weiter nutzen, wenn du der neuen Fassung nach der Anmeldung zugestimmt hast. Bist du nicht einverstanden, meldest du dich ab; ohne Zustimmung gibt es keinen Zugriff, und du kannst deine Daten löschen lassen. Frühere Fassungen bleiben abrufbar.

## 9. Anwendbares Recht

Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften des Staates, in dem du lebst, bleiben unberührt.$de$, $en$## 1. Operator and scope

ftree is run privately and non-commercially by {{operator.name}} ({{operator.email}}). These terms apply to everyone who uses ftree.

## 2. Free test service, invitation only

ftree is a free test service (beta) for a closed group. Access is by personal invitation only; there is no registration and no right to access. Do not pass your access on to others.

You must be at least 16 years old to use ftree.

Limits apply: you can own at most 5 trees, a tree holds at most 100 people, and there are at most 50 accounts in total. Once that limit is reached, nobody new can be invited.

## 3. Availability and data loss

There is no guarantee of availability. Features may change or disappear, the service may be interrupted or discontinued, and data may be lost despite backups; backups are made once a night, so up to a day of changes can be lost. Export your trees regularly as GEDCOM files (download button on the family card); photos are not included. A discontinuation will be announced in advance where possible.

## 4. Your content

You are responsible for what you enter. Enter data about living persons only if you are entitled to, and remove it when they ask you to. Upload photos only if you hold the rights to them and the people shown agree.

Be careful with data about children: for minors, enter only what the tree needs, and only if their parents or guardians agree.

Do not write especially sensitive details about others in notes, such as their health, religion, sexual orientation, or political views, unless the person has expressly agreed or the detail concerns only deceased persons.

You keep all rights to your content. You allow the operator to store it and show it to the people you share a tree with, as far as needed to run ftree.

## 5. Prohibited content and use

No illegal, insulting, or discriminatory content, nothing that infringes the rights of others, and no attacks on or misuse of the service.

## 6. Removal of access and deletion

The operator may remove your access and delete your account or content that violates these terms or the law, or when this is legally required. Where possible, you will be informed by email beforehand.

## 7. Liability

As ftree is provided free of charge, the operator is liable only for intent and gross negligence (as in §§ 521, 599 of the German Civil Code). This does not limit liability for injury to life, body, or health.

## 8. Changes

Changes to these terms are announced in the app at least two weeks in advance. From the announced day on you can only go on using ftree after accepting the new version when you sign in. If you do not agree, sign out; without acceptance there is no access, and you can have your data deleted. Earlier versions stay available.

## 9. Applicable law

German law applies. Mandatory consumer protection rules of the country you live in remain unaffected.$en$)) AS texts (body_de, body_en);

INSERT INTO legal_documents (kind, version, effective_at, requires_action, body_de, body_en, content_sha256)
SELECT 'privacy', 1, now(), true, body_de, body_en, encode(sha256(convert_to(body_de, 'UTF8')), 'hex')
FROM (VALUES ($de$## 1. Verantwortlicher

Verantwortlich ist {{operator.name}}, E-Mail {{operator.email}}. ftree wird privat und nicht kommerziell für einen geschlossenen, eingeladenen Kreis betrieben.

## 2. Welche Daten verarbeitet werden

- Konto: deine E-Mail-Adresse, mit der du eingeladen wurdest und dich anmeldest, dein Anzeigename, deine Rollen und Rechte in den Stammbäumen, wann du zuerst und zuletzt angemeldet warst, sowie E-Mail-Adressen, für die Einladungen erstellt wurden.
- Anmeldung und Zugriff: Bei jedem Aufruf verarbeiten Cloudflare und unser Server technische Daten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browserkennung und das Ergebnis der Anmeldung; Cloudflare schickt dir außerdem den Einmal-PIN per E-Mail.
- Stammbauminhalte: Namen, Geburts- und Sterbedaten und -orte, Notizen, Fotos und Verwandtschaftsbeziehungen der eingetragenen Personen, auch lebender Personen, die ftree selbst nicht nutzen; diese Daten stammen von den Nutzern, die sie eintragen.
- Ein Änderungsprotokoll hält fest, wer wann was geändert hat.
- Zustimmungen: welche Fassung der Nutzungsbedingungen und dieser Hinweise du wann und in welcher Sprache angenommen hast; IP-Adresse und Browserkennung werden dabei nicht gespeichert.

## 3. Zwecke und Rechtsgrundlagen

- Bereitstellung von ftree für dich (Konto, Anmeldung, Speichern und Teilen deiner Stammbäume): Art. 6 Abs. 1 lit. b DSGVO.
- Sicherheit, Missbrauchsabwehr, Fehleranalyse, Protokolle und Datensicherungen sowie der Nachweis von Zustimmungen: Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse ist ein sicherer, stabiler und nachvollziehbarer Betrieb ohne Datenverlust.
- Daten lebender Personen, die ftree nicht selbst nutzen: Art. 6 Abs. 1 lit. f DSGVO (Interesse der Nutzer an gemeinsamer Familienforschung). Widerspricht die Person, werden ihre Daten entfernt.

## 4. Empfänger und Auftragsverarbeiter

- Hetzner Online GmbH, Gunzenhausen, Deutschland: Hosting von Server, Datenbank und Datensicherungen in Rechenzentren in Deutschland, als Auftragsverarbeiter (Art. 28 DSGVO).
- Cloudflare, Inc., San Francisco, USA: Anmeldung (Cloudflare Access, einschließlich Versand des PINs) und verschlüsselte Verbindung (Cloudflare Tunnel), über die alle Aufrufe laufen, als Auftragsverarbeiter. Dabei können Daten in die USA übermittelt werden; Cloudflare ist nach dem EU-US Data Privacy Framework zertifiziert (Angemessenheitsbeschluss, Art. 45 DSGVO).
- Andere Nutzer: Personen, mit denen ein Stammbaum geteilt ist, sehen dessen Inhalte. Wer gerade im selben Stammbaum ist, sieht außerdem deine E-Mail-Adresse und was du gerade tust.
- Administratoren: Sie können jeden Stammbaum öffnen, auch ohne dazu eingeladen zu sein; das wird im Protokoll festgehalten. Sie sehen auch, welche Fassungen du angenommen hast.

Daten werden nicht verkauft und nicht für Werbung genutzt.

## 5. Speicherdauer

- Konto, einschließlich der Zeitpunkte deiner Anmeldungen und deiner Zustimmungen: bis du die Löschung verlangst oder dein Konto gelöscht wird.
- Stammbäume: bis sie gelöscht werden; ein gelöschter Stammbaum liegt 30 Tage im Papierkorb und wird dann endgültig entfernt.
- Änderungsprotokoll: Änderungen an Personen im Stammbaum 90 Tage, alle übrigen Einträge 12 Monate.
- Technische Protokolle und Messwerte des Servers: höchstens 15 Tage. Für Daten bei Cloudflare gelten dessen Fristen.
- Datensicherungen: Gelöschte Daten bleiben höchstens 30 Tage in Datensicherungen enthalten, bis diese überschrieben werden.

## 6. Deine Rechte

Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen nach Art. 6 Abs. 1 lit. f (Art. 21). Schreib dazu an {{operator.email}}. Deine Stammbäume kannst du jederzeit selbst als GEDCOM-Datei exportieren; Fotos sind darin nicht enthalten und kommen auf Anfrage per E-Mail. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77).

## 7. Cookies und lokaler Speicher

Es wird nur technisch Notwendiges gespeichert, deshalb gibt es kein Cookie-Banner:

- Cookies: Cloudflare Access setzt CF_Authorization und CF_AppSession, damit du angemeldet bleibst.
- Lokaler Speicher deines Browsers: deine Einstellungen (Sprache, Darstellung, Animation, Kartenstil, Kartendichte, Linien, Legende und Position von Panels), der zuletzt geöffnete Stammbaum (ftree.lastTree) und ob du die Einführung gesehen hast (ftree.tourDone).
- Sitzungsspeicher deines Browsers: Angaben zum Übergang zwischen Seiten (ftree.ride, ftree.rideBack).

Diese Angaben verlassen deinen Browser nicht. Es gibt kein Tracking, keine Analyse und keine Werbung.

## 8. Standort

Für den Stand von Sonne und Mond über dem Stammbaum kann ftree deinen Browser nach deinem Standort fragen. Das geschieht nur, wenn du es erlaubst; der Standort bleibt in deinem Browser und wird nicht an den Server geschickt. Ohne Erlaubnis richtet sich der Himmel nach deiner Zeitzone.

## 9. Daten anderer Personen

Trage Daten lebender Personen nur ein, wenn es dafür eine Rechtsgrundlage gibt, und beachte ihren Widerspruch. Jede eingetragene Person kann sich an {{operator.email}} wenden und die Entfernung ihrer Daten verlangen, auch wenn sie ftree nicht nutzt. Verstorbene fallen nicht unter die DSGVO (Erwägungsgrund 27), die Rechte ihrer lebenden Angehörigen bleiben aber bestehen.$de$, $en$## 1. Controller

The controller is {{operator.name}}, email {{operator.email}}. ftree is run privately and non-commercially for a closed, invited group.

## 2. What data is processed

- Account: your email address, with which you were invited and sign in, your display name, your roles and rights in the trees, when you first and last signed in, and email addresses others have been invited with.
- Sign-in and access: on every request Cloudflare and our server process technical data such as IP address, time, requested address, browser identification, and the result of the sign-in; Cloudflare also sends you the one-time PIN by email.
- Tree content: names, dates and places of birth and death, notes, photos, and relationships of the persons entered, including living persons who do not use ftree themselves; this data comes from the users who enter it.
- A change log records who changed what and when.
- Acceptances: which version of the terms and of this notice you accepted, when, and in which language; neither your IP address nor your browser identification is stored with them.

## 3. Purposes and legal bases

- Providing ftree to you (account, sign-in, storing and sharing your trees): Art. 6(1)(b) GDPR.
- Security, prevention of misuse, error analysis, logs, and backups, and proving acceptances: Art. 6(1)(f) GDPR; the legitimate interest is a secure, stable, and traceable service without data loss.
- Data about living persons who do not use ftree: Art. 6(1)(f) GDPR (the users’ interest in shared family research). If the person objects, their data is removed.

## 4. Recipients and processors

- Hetzner Online GmbH, Gunzenhausen, Germany: hosting of the server, the database, and the backups in data centres in Germany, as a processor (Art. 28 GDPR).
- Cloudflare, Inc., San Francisco, USA: sign-in (Cloudflare Access, including sending the PIN) and the encrypted connection (Cloudflare Tunnel), through which all requests pass, as a processor. Data may be transferred to the USA; Cloudflare is certified under the EU-US Data Privacy Framework (adequacy decision, Art. 45 GDPR).
- Other users: the people a tree is shared with see its content. Whoever is in the same tree at the same time also sees your email address and what you are doing.
- Administrators: they can open every tree, even without an invitation; this is recorded in the log. They also see which versions you accepted.

Data is not sold or used for advertising.

## 5. Retention

- Account, including the times of your sign-ins and your acceptances: until you ask for its deletion or your account is deleted.
- Trees: until they are deleted; a deleted tree stays in the trash for 30 days and is then removed for good.
- Change log: changes to persons in a tree for 90 days, all other entries for 12 months.
- The server’s technical logs and metrics: at most 15 days. Cloudflare’s own periods apply to data held by Cloudflare.
- Backups: deleted data remains in backups for at most 30 days, until they are overwritten.

## 6. Your rights

You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20), and objection to processing based on Art. 6(1)(f) (Art. 21). Write to {{operator.email}}. You can export your trees yourself as GEDCOM files at any time; photos are not included and are sent by email on request. You may also lodge a complaint with a data protection supervisory authority (Art. 77).

## 7. Cookies and local storage

Only technically necessary storage is used, which is why there is no cookie banner:

- Cookies: Cloudflare Access sets CF_Authorization and CF_AppSession to keep you signed in.
- Your browser’s local storage: your settings (language, appearance, animation, card style, card density, lines, legend, and panel positions), the tree you last opened (ftree.lastTree), and whether you have seen the introduction (ftree.tourDone).
- Your browser’s session storage: details of the transition between pages (ftree.ride, ftree.rideBack).

These details never leave your browser. There is no tracking, no analytics, and no advertising.

## 8. Location

To place the sun and moon above the tree, ftree may ask your browser for your location. This happens only if you allow it; the location stays in your browser and is not sent to the server. Without permission the sky follows your time zone.

## 9. Data about other persons

Enter data about living persons only if you have a legal basis for it, and respect their objection. Every person entered can write to {{operator.email}} and ask for their data to be removed, even if they do not use ftree. Deceased persons are not covered by the GDPR (Recital 27), but the rights of their living relatives remain.$en$)) AS texts (body_de, body_en);

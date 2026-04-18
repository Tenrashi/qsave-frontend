import { LegalLayout } from "./LegalLayout";

export const PrivacyEn = () => (
  <LegalLayout title="Privacy Policy" updated="18 April 2026">
    <p>
      This Privacy Policy describes how QSave ("we", "us", "our") handles
      information in connection with the QSave desktop application and the
      website at qsave.app (together, the "Service").
    </p>
    <p>
      QSave is operated by{" "}
      <strong>Pierre-Antoine N. (auto-entrepreneur, SIREN 899 397 947)</strong>,
      based in France. For any privacy question, contact us at{" "}
      <a href="mailto:dev@qsave.app">dev@qsave.app</a>.
    </p>

    <h2>1. Summary</h2>
    <ul>
      <li>
        <strong>QSave does not run any backend that stores your data.</strong>{" "}
        We don't operate user accounts, databases, or servers that hold your
        personal information.
      </li>
      <li>
        Your game save files, device identifiers, and related metadata are
        stored in <strong>your own Google Drive</strong>, inside a folder QSave
        creates.
      </li>
      <li>
        When you sign in, you sign in directly with Google. QSave never sees
        your Google password.
      </li>
      <li>
        We do not sell, transfer, or use your data for advertising or AI model
        training.
      </li>
    </ul>

    <h2>2. Information handled by the app</h2>

    <h3>2.1 Google sign-in</h3>
    <p>
      QSave signs you in directly with Google via OAuth. The resulting access
      token is stored in your operating system's native keychain on your device.
      The token never leaves your machine except to call Google's APIs directly
      from your computer.
    </p>
    <p>
      We (QSave) do not receive, store, or have access to your Google password,
      email, or profile information.
    </p>

    <h3>2.2 Google Drive data</h3>
    <p>
      QSave uses the <code>drive.file</code> scope. This scope is restricted to
      files the app creates itself. We never access, read, or list files QSave
      did not create.
    </p>
    <p>Inside the QSave folder on your Drive we read and write:</p>
    <ul>
      <li>Your game save files (copied from your computer by you)</li>
      <li>
        Metadata files describing which game each save belongs to, and
        per-device path information so backups can sync across your machines
      </li>
    </ul>
    <p>
      All of this content lives in your Drive. It is not copied to, processed
      by, or stored on any QSave server.
    </p>

    <h3>2.3 Device identifier</h3>
    <p>
      QSave generates a random device identifier the first time it runs on a
      machine. The identifier is stored alongside your saves in your Google
      Drive. It exists so that when you use QSave on more than one computer,
      each machine's save paths can be tracked independently.
    </p>

    <h2>3. Google API Services — Limited Use disclosure</h2>
    <p>
      QSave's use of information received from Google APIs complies with
      Google's{" "}
      <a
        href="https://developers.google.com/terms/api-services-user-data-policy"
        target="_blank"
        rel="noopener noreferrer"
      >
        API Services User Data Policy
      </a>
      , including the <strong>Limited Use</strong> requirements. Specifically:
    </p>
    <ul>
      <li>
        We use Google Drive data only to provide user-facing features of QSave
        (backing up, restoring, and listing your game saves).
      </li>
      <li>We do not transfer Google Drive data to third parties.</li>
      <li>We do not use Google Drive data for serving ads.</li>
      <li>
        We do not allow humans to read Drive data. QSave has no backend that
        could even receive it.
      </li>
    </ul>

    <h2>4. The qsave.app website</h2>
    <p>
      The marketing website at qsave.app is hosted on Cloudflare Pages. Like any
      web host, Cloudflare processes standard request data (IP address, browser
      user agent) to serve the site and protect against abuse.
    </p>
    <p>
      The website stores a language preference in your browser's{" "}
      <code>localStorage</code> so your chosen language persists between visits.
      The website does not use tracking cookies or analytics.
    </p>

    <h2>5. What we do not collect</h2>
    <ul>
      <li>No email addresses, names, or profile data</li>
      <li>No save file contents</li>
      <li>No browsing or usage analytics</li>
      <li>No advertising identifiers</li>
      <li>No crash or telemetry reports</li>
      <li>No Google Drive files outside the QSave folder</li>
    </ul>

    <h2>6. Your rights</h2>
    <p>
      Because QSave does not store your personal data on any server we operate,
      there is effectively nothing for us to access, correct, or delete on your
      behalf. You retain full control:
    </p>
    <ul>
      <li>
        <strong>Delete your backups</strong> — remove the QSave folder from your
        Google Drive.
      </li>
      <li>
        <strong>Revoke access</strong> — disconnect QSave at your{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Account permissions page
        </a>
        .
      </li>
      <li>
        <strong>Uninstall</strong> — remove the app from your machine. The OAuth
        token in your keychain is removed with the app's keychain entry.
      </li>
    </ul>
    <p>
      If you are in the European Economic Area, you also have the right to lodge
      a complaint with the French data protection authority (CNIL) or your local
      authority.
    </p>

    <h2>7. Security</h2>
    <ul>
      <li>OAuth tokens stored in your operating system's native keychain.</li>
      <li>TLS encryption for all network traffic.</li>
      <li>
        Principle of least privilege — we request the minimum Google Drive scope
        needed (<code>drive.file</code>).
      </li>
    </ul>
    <p>QSave is open source; you can inspect the client code on GitHub.</p>

    <h2>8. Children</h2>
    <p>
      QSave is not intended for children under 13 (or under 16 in the European
      Economic Area, where applicable).
    </p>

    <h2>9. Changes to this policy</h2>
    <p>
      We may update this policy if the Service changes (for example, if we ever
      introduce a paid tier with server-side storage). Material changes will be
      posted here with a new "last updated" date.
    </p>

    <h2>10. Contact</h2>
    <p>
      For privacy questions: <a href="mailto:dev@qsave.app">dev@qsave.app</a>.
    </p>
  </LegalLayout>
);

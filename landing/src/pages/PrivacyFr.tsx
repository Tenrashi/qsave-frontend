import { LegalLayout } from "./LegalLayout";

export const PrivacyFr = () => (
  <LegalLayout title="Politique de confidentialité" updated="18 avril 2026">
    <p>
      La présente Politique de confidentialité décrit la manière dont QSave («
      nous », « notre ») traite les informations dans le cadre de l'application
      de bureau QSave et du site qsave.app (ensemble, le « Service »).
    </p>
    <p>
      QSave est exploité par{" "}
      <strong>Pierre-Antoine N. (auto-entrepreneur, SIREN 899 397 947)</strong>,
      domicilié en France. Pour toute question relative à la confidentialité,
      contactez-nous à <a href="mailto:dev@qsave.app">dev@qsave.app</a>.
    </p>

    <h2>1. Résumé</h2>
    <ul>
      <li>
        <strong>QSave n'exploite aucun serveur stockant vos données.</strong>{" "}
        Nous ne gérons ni comptes utilisateurs, ni bases de données, ni serveurs
        hébergeant vos informations personnelles.
      </li>
      <li>
        Vos fichiers de sauvegarde de jeu, identifiants d'appareil et
        métadonnées associées sont stockés dans{" "}
        <strong>votre propre Google Drive</strong>, dans un dossier créé par
        QSave.
      </li>
      <li>
        Lorsque vous vous connectez, vous vous connectez directement auprès de
        Google. QSave ne voit jamais votre mot de passe Google.
      </li>
      <li>
        Nous ne vendons, ne transférons ni n'utilisons vos données à des fins
        publicitaires ou d'entraînement de modèles d'IA.
      </li>
    </ul>

    <h2>2. Informations traitées par l'application</h2>

    <h3>2.1 Connexion Google</h3>
    <p>
      QSave vous connecte directement à Google via OAuth. Le jeton d'accès
      obtenu est stocké dans le trousseau natif de votre système d'exploitation,
      sur votre appareil. Le jeton ne quitte jamais votre machine, si ce n'est
      pour appeler les API de Google directement depuis votre ordinateur.
    </p>
    <p>
      Nous (QSave) ne recevons, ne stockons ni n'avons accès à votre mot de
      passe Google, à votre adresse e-mail ou à vos informations de profil.
    </p>

    <h3>2.2 Données Google Drive</h3>
    <p>
      QSave utilise le scope <code>drive.file</code>. Ce scope est restreint aux
      fichiers que l'application crée elle-même. Nous n'accédons, ne lisons ni
      ne listons jamais les fichiers que QSave n'a pas créés.
    </p>
    <p>Dans le dossier QSave de votre Drive, nous lisons et écrivons :</p>
    <ul>
      <li>
        Vos fichiers de sauvegarde de jeu (copiés depuis votre ordinateur par
        vous-même)
      </li>
      <li>
        Des fichiers de métadonnées indiquant à quel jeu appartient chaque
        sauvegarde, ainsi que les chemins par appareil permettant la
        synchronisation entre vos machines
      </li>
    </ul>
    <p>
      L'ensemble de ces contenus reste sur votre Drive. Rien n'est copié, traité
      ou stocké sur un quelconque serveur QSave.
    </p>

    <h3>2.3 Identifiant d'appareil</h3>
    <p>
      QSave génère un identifiant d'appareil aléatoire lors de sa première
      exécution sur une machine. Cet identifiant est stocké dans votre Google
      Drive, aux côtés de vos sauvegardes. Il existe pour que, lorsque vous
      utilisez QSave sur plusieurs ordinateurs, les chemins de sauvegarde de
      chaque machine puissent être suivis indépendamment.
    </p>

    <h2>3. Google API Services — déclaration « Limited Use »</h2>
    <p>
      L'utilisation par QSave des informations reçues des API Google est
      conforme à la{" "}
      <a
        href="https://developers.google.com/terms/api-services-user-data-policy"
        target="_blank"
        rel="noopener noreferrer"
      >
        API Services User Data Policy
      </a>{" "}
      de Google, y compris aux exigences <strong>« Limited Use »</strong>. En
      particulier :
    </p>
    <ul>
      <li>
        Nous utilisons les données Google Drive uniquement pour fournir les
        fonctionnalités utilisateur de QSave (sauvegarder, restaurer et lister
        vos sauvegardes de jeu).
      </li>
      <li>Nous ne transférons pas les données Google Drive à des tiers.</li>
      <li>
        Nous n'utilisons pas les données Google Drive pour diffuser de la
        publicité.
      </li>
      <li>
        Nous n'autorisons aucune lecture humaine des données Drive. QSave ne
        dispose d'aucun serveur susceptible de les recevoir.
      </li>
    </ul>

    <h2>4. Le site qsave.app</h2>
    <p>
      Le site vitrine qsave.app est hébergé sur Cloudflare Pages. Comme tout
      hébergeur web, Cloudflare traite des données de requête standard (adresse
      IP, user agent du navigateur) pour servir le site et prévenir les abus.
    </p>
    <p>
      Le site stocke une préférence de langue dans le <code>localStorage</code>{" "}
      de votre navigateur afin que votre choix soit conservé entre les visites.
      Le site n'utilise ni cookies de suivi ni outils d'analyse.
    </p>

    <h2>5. Ce que nous ne collectons pas</h2>
    <ul>
      <li>Aucune adresse e-mail, aucun nom, aucune donnée de profil</li>
      <li>Aucun contenu de vos fichiers de sauvegarde</li>
      <li>Aucune donnée de navigation ni d'usage</li>
      <li>Aucun identifiant publicitaire</li>
      <li>Aucun rapport de plantage ni de télémétrie</li>
      <li>Aucun fichier Google Drive en dehors du dossier QSave</li>
    </ul>

    <h2>6. Vos droits</h2>
    <p>
      Comme QSave ne conserve aucune donnée personnelle sur un serveur que nous
      exploitons, nous n'avons concrètement rien à consulter, corriger ou
      supprimer en votre nom. Vous gardez un contrôle total :
    </p>
    <ul>
      <li>
        <strong>Supprimer vos sauvegardes</strong> — retirez le dossier QSave de
        votre Google Drive.
      </li>
      <li>
        <strong>Révoquer l'accès</strong> — déconnectez QSave depuis votre{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          page d'autorisations Google
        </a>
        .
      </li>
      <li>
        <strong>Désinstaller</strong> — supprimez l'application de votre
        machine. Le jeton OAuth dans votre trousseau est supprimé en même temps
        que l'entrée de l'application.
      </li>
    </ul>
    <p>
      Si vous résidez dans l'Espace économique européen, vous avez également le
      droit d'introduire une réclamation auprès de la Commission nationale de
      l'informatique et des libertés (CNIL) ou de votre autorité de protection
      des données locale.
    </p>

    <h2>7. Sécurité</h2>
    <ul>
      <li>
        Jetons OAuth stockés dans le trousseau natif de votre système
        d'exploitation.
      </li>
      <li>Chiffrement TLS pour l'ensemble du trafic réseau.</li>
      <li>
        Principe du moindre privilège — nous demandons le scope Google Drive
        minimum nécessaire (<code>drive.file</code>).
      </li>
    </ul>
    <p>
      QSave est open source ; vous pouvez consulter le code du client sur
      GitHub.
    </p>

    <h2>8. Enfants</h2>
    <p>
      QSave n'est pas destiné aux enfants de moins de 13 ans (ou de moins de 16
      ans dans l'Espace économique européen, le cas échéant).
    </p>

    <h2>9. Modifications de la présente politique</h2>
    <p>
      Nous pouvons mettre à jour la présente politique si le Service évolue (par
      exemple, si une offre payante avec stockage côté serveur devait voir le
      jour). Les modifications importantes seront publiées ici avec une nouvelle
      date de « dernière mise à jour ».
    </p>

    <h2>10. Contact</h2>
    <p>
      Pour toute question relative à la confidentialité :{" "}
      <a href="mailto:dev@qsave.app">dev@qsave.app</a>.
    </p>
  </LegalLayout>
);

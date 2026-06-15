import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BoardlyBrand } from "@/components/boardly-brand";

type LegalPageProps = {
  type: "terms" | "privacy";
};

const updatedAt = "June 13, 2026";

function LegalShell({ type, title, children }: LegalPageProps & { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FDFCF8] px-5 py-8 text-neutral-900 dark:bg-[#0A0A0A] dark:text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-center justify-between gap-4">
          <BoardlyBrand to="/" className="text-lg" />
          <nav className="flex items-center gap-4 text-sm font-medium text-neutral-500">
            <Link to="/terms" className={type === "terms" ? "text-neutral-950 dark:text-white" : "hover:text-neutral-900 dark:hover:text-white"}>
              Terms
            </Link>
            <Link to="/privacy" className={type === "privacy" ? "text-neutral-950 dark:text-white" : "hover:text-neutral-900 dark:hover:text-white"}>
              Privacy
            </Link>
          </nav>
        </header>

        <main className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-8">
          <p className="mb-3 text-sm font-medium text-neutral-500">Last updated: {updatedAt}</p>
          <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <div className="space-y-7 text-sm leading-7 text-neutral-700 dark:text-neutral-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-neutral-950 dark:text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <LegalShell type="terms" title="Terms of Service">
      <Section title="1. Service">
        <p>
          Boardly is a visual workspace for creating boards, saving references, and organizing links,
          images, notes, and imported content. By using Boardly, you agree to use the service lawfully
          and only with content you have the right to access, store, or share.
        </p>
      </Section>

      <Section title="2. Accounts">
        <p>
          You are responsible for your account, your credentials, and all activity under your account.
          You must provide accurate information and keep your login details secure.
        </p>
      </Section>

      <Section title="3. User content">
        <p>
          You keep ownership of the content you add to Boardly. You grant Boardly the limited right to
          store, display, process, and transmit that content only as needed to operate the service.
        </p>
        <p>
          Do not upload or share unlawful, infringing, harmful, private, or abusive content. We may
          remove content or restrict access if required to protect the service or comply with law.
        </p>
      </Section>

      <Section title="4. Third-party services">
        <p>
          Boardly may let you connect third-party services such as X. Third-party content and APIs are
          governed by their own terms. You are responsible for complying with those terms when you
          connect an external account or import external content.
        </p>
      </Section>

      <Section title="5. Availability and changes">
        <p>
          Boardly is provided as-is and may change over time. We may update, suspend, or discontinue
          parts of the service when needed for maintenance, security, product changes, or legal reasons.
        </p>
      </Section>

      <Section title="6. Liability">
        <p>
          To the maximum extent allowed by law, Boardly is not liable for indirect damages, lost data,
          lost profits, or issues caused by third-party services, user content, or external links.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          For questions about these terms, contact the Boardly operator through the support channel
          provided in the app or project repository.
        </p>
      </Section>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell type="privacy" title="Privacy Policy">
      <Section title="1. Information we collect">
        <p>
          Boardly collects account information such as name, email address, authentication session data,
          and the content you create in boards, including notes, links, images, comments, and board
          metadata.
        </p>
      </Section>

      <Section title="2. X integration data">
        <p>
          If you connect X, Boardly uses OAuth 2.0 to request permission to read your X account identity
          and bookmarked posts. Boardly may import post text, post IDs, author display names and
          usernames, media preview URLs, and public post URLs.
        </p>
        <p>
          This data is used only to create or refresh your private Twitter Bookmarks board. Boardly does
          not post, like, bookmark, follow, unfollow, delete, sell, advertise with, profile users from,
          or train AI models on X data.
        </p>
      </Section>

      <Section title="3. How we use information">
        <p>
          We use information to provide authentication, save and sync boards, generate previews, enable
          collaboration features, operate integrations, prevent abuse, debug issues, and improve service
          reliability.
        </p>
      </Section>

      <Section title="4. Sharing">
        <p>
          Boardly does not sell personal information. Content is private by default unless you choose to
          share a board. We may use infrastructure providers to host the app, database, authentication,
          storage, and deployment systems.
        </p>
      </Section>

      <Section title="5. Retention and deletion">
        <p>
          Board data and imported integration data are kept while your account or boards exist. You can
          delete boards in the app. Disconnecting or revoking X access stops future imports but does not
          automatically remove already imported board content.
        </p>
      </Section>

      <Section title="6. Security">
        <p>
          We use reasonable technical measures to protect account sessions, API tokens, and stored board
          data. No online service can guarantee absolute security.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          For privacy questions or deletion requests, contact the Boardly operator through the support
          channel provided in the app or project repository.
        </p>
      </Section>
    </LegalShell>
  );
}

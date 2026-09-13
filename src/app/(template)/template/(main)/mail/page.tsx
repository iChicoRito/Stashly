import { mails } from "./_components/data";
import { MailComponent } from "./_components/mail";
import { DEFAULT_MAIL_LAYOUT } from "./_components/mail-layout-config";

/**
 * The mail layout cookie is read on the client by `MailComponent`, because a
 * static export has no server to read cookies at request time.
 */
export default function Page() {
  return (
    <div className="h-dvh min-h-0 overflow-hidden">
      <MailComponent mails={mails} defaultLayout={[...DEFAULT_MAIL_LAYOUT]} />
    </div>
  );
}

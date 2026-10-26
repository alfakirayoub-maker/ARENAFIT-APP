import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="login">
      <div className="panel center">
        <h1>Page introuvable</h1>
        <Link className="btn" href="/">
          Retour au tableau de bord
        </Link>
      </div>
    </main>
  );
}

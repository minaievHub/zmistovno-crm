import Link from "next/link";
export default function NotFound() {
  return (
    <div className="standalone">
      <div className="brand">✳ Змістовно</div>
      <h1>Такої сторінки немає</h1>
      <p>Перевірте посилання або поверніться на головну.</p>
      <Link href="/" className="btn btn-primary">
        На головну
      </Link>
    </div>
  );
}

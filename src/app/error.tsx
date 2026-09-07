"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="standalone">
      <h1>Не вдалося завантажити сторінку</h1>
      <p>Перевірте підключення та налаштування бази даних.</p>
      <button className="btn btn-primary" onClick={reset}>
        Спробувати ще раз
      </button>
    </div>
  );
}

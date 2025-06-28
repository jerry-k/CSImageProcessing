import { Link } from 'react-router-dom';

export function NavBar() {
  return (
    <nav className="bg-gray-800 text-white px-6 py-4">
      <div className="container mx-auto">
        <Link to="/" className="text-2xl font-bold hover:text-gray-300">CoastSnap</Link>
      </div>
    </nav>
  );
}
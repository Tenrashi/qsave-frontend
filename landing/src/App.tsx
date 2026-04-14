import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { FAQ } from "./components/FAQ";
import { Support } from "./components/Support";
import { Footer } from "./components/Footer";

export const App = () => (
  <div id="top" className="min-h-screen bg-background text-foreground">
    <Nav />
    <Hero />
    <Features />
    <FAQ />
    <Support />
    <Footer />
  </div>
);

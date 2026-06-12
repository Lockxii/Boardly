import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  MousePointer2,
  Pencil,
  Share2,
  Zap,
  Brain,
  Rocket,
  Code2,
  Layers,
  MessageSquare,
  ChevronDown,
  Users,
  Infinity as InfinityIcon,
  Undo2,
} from "lucide-react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUser } from "@/lib/auth-client";
import { LandingNavbar } from "@/components/landing-navbar";
import { BoardlyBrand } from "@/components/boardly-brand";
import type { User } from "@/lib/types";

const FAQ_ITEMS = [
  {
    q: "Boardly est-il vraiment gratuit ?",
    a: "Oui, pour l'instant tout est gratuit. Pas de carte bancaire, pas de limite de temps. On veut que vous testiez sans friction.",
  },
  {
    q: "Puis-je collaborer avec mon équipe ?",
    a: "Absolument. Invitez vos coéquipiers par email, voyez leurs curseurs en direct et éditez le même canvas simultanément.",
  },
  {
    q: "Mes données sont-elles sauvegardées ?",
    a: "Vos tableaux sont sauvegardés automatiquement. Vous pouvez reprendre votre travail à tout moment, depuis n'importe quel navigateur.",
  },
  {
    q: "Ça remplace Miro ou FigJam ?",
    a: "Pour le brainstorming rapide, les diagrammes et la planification visuelle — oui. Boardly est pensé pour aller vite, sans la lourdeur des gros outils.",
  },
  {
    q: "Faut-il installer quelque chose ?",
    a: "Non. Boardly tourne entièrement dans le navigateur. Ouvrez un onglet et c'est parti.",
  },
] as const;

const TESTIMONIALS = [
  { quote: "On a remplacé nos stand-ups PowerPoint par un canvas Boardly. Game changer.", author: "Lucas M.", role: "Engineering Lead", color: "bg-[#FFD02F] text-black" },
  { quote: "Enfin un outil où je peux griffonner mes idées sans me sentir coupable.", author: "Camille R.", role: "UX Designer", color: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300" },
  { quote: "L'équipe produit l'utilise pour chaque sprint planning. C'est devenu notre rituel.", author: "Antoine D.", role: "Product Manager", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
] as const;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left font-semibold text-lg hover:text-blue-600 dark:hover:text-blue-400 transition group"
      >
        {q}
        <ChevronDown className={`h-5 w-5 shrink-0 ml-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-neutral-500 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CanvasMockup() {
  return (
    <div className="relative rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <span className="text-xs text-neutral-400 ml-2 font-medium">Mon super projet — Boardly</span>
      </div>

      <div className="relative aspect-[16/10] bg-[#FDFCF8] dark:bg-neutral-950 overflow-hidden">
        {/* Grid */}
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#a3a3a3_1px,transparent_1px)] [background-size:20px_20px]" />

        {/* Toolbar */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-neutral-800 rounded-full px-3 py-1.5 shadow-lg border border-neutral-200 dark:border-neutral-700">
          {[Pencil, MousePointer2, Layers].map((Icon, i) => (
            <div key={i} className={`p-1.5 rounded-full ${i === 0 ? "bg-blue-600 text-white" : "text-neutral-500"}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          ))}
        </div>

        {/* Canvas elements */}
        <motion.div
          className="absolute top-[22%] left-[8%] w-36 h-24 bg-[#FFD02F] shadow-lg rotate-[-4deg] p-3 text-xs font-medium text-black/80"
          animate={{ rotate: [-4, -2, -4] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          Idée #1 ✨
        </motion.div>

        <div className="absolute top-[30%] left-[38%] w-44 h-28 bg-white dark:bg-neutral-800 rounded-lg border-2 border-blue-500 shadow-lg p-3">
          <div className="h-2 w-3/4 bg-neutral-200 dark:bg-neutral-600 rounded mb-2" />
          <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-700 rounded mb-1" />
          <div className="h-2 w-5/6 bg-neutral-100 dark:bg-neutral-700 rounded" />
        </div>

        <div className="absolute bottom-[25%] right-[12%] w-28 h-28 bg-purple-100 dark:bg-purple-900/40 rounded-full border-2 border-purple-300 dark:border-purple-700 shadow-md" />

        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          <line x1="180" y1="120" x2="320" y2="160" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 4" />
        </svg>

        {/* Live cursor */}
        <motion.div
          className="absolute top-[45%] right-[30%]"
          animate={{ x: [0, 30, 10, 0], y: [0, -20, 15, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <MousePointer2 className="w-5 h-5 text-[#EC4899] fill-[#EC4899]" />
          <div className="ml-3 -mt-3 bg-[#EC4899] text-white text-[10px] px-1.5 py-0.5 rounded font-bold">Julie</div>
        </motion.div>

        {/* Minimap */}
        <div className="absolute bottom-3 right-3 w-20 h-14 bg-white/80 dark:bg-neutral-800/80 backdrop-blur rounded border border-neutral-200 dark:border-neutral-700 p-1">
          <div className="w-full h-full bg-neutral-100 dark:bg-neutral-700 rounded-sm relative">
            <div className="absolute top-1 left-2 w-6 h-4 border border-blue-500 bg-blue-500/20 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -40]);

  const { data: user } = useQuery<User | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const isLoggedIn = !!user;
  const ctaTo = isLoggedIn ? "/dashboard" : "/auth/sign-in";

  return (
    <div ref={containerRef} className="min-h-screen bg-[#FDFCF8] dark:bg-[#0A0A0A] text-neutral-900 dark:text-white overflow-hidden font-sans selection:bg-yellow-200 selection:text-black">
      <LandingNavbar isLoggedIn={isLoggedIn} ctaTo={ctaTo} />

      {/* Hero */}
      <section className="relative isolate min-h-[90vh] flex flex-col items-center justify-center pt-24">
        <div className="absolute inset-0 z-0 opacity-40 dark:opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(#a3a3a3_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />
        </div>

        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div
            style={{ y: y1, rotate: -5 }}
            className="absolute top-[14%] left-[4%] sm:left-[8%] md:left-[12%] lg:left-[14%] w-44 md:w-48 h-44 md:h-48 bg-[#FFD02F] shadow-xl rotate-[-6deg] p-5 md:p-6 text-lg md:text-2xl leading-tight flex items-center justify-center text-center text-black/80"
            initial={{ opacity: 0, scale: 0.8, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "backOut" }}
          >
            "Ça claque !" ✨
          </motion.div>

          <motion.div
            className="absolute top-[22%] right-[6%] sm:right-[10%] md:right-[12%]"
            animate={{ x: [0, -24, -12, 0], y: [0, 16, -8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          >
            <MousePointer2 className="w-6 h-6 text-[#EC4899] fill-[#EC4899]" />
            <div className="ml-4 -mt-4 bg-[#EC4899] text-white text-xs px-2 py-1 rounded-md font-bold">Julie</div>
          </motion.div>

          <motion.div
            style={{ y: y2, rotate: 5 }}
            className="absolute bottom-[16%] right-[4%] sm:right-[8%] md:right-[12%] w-56 md:w-64 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-2xl p-4 hidden sm:block"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-700 pb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">TM</div>
              <div className="flex-1 h-2 bg-neutral-100 rounded-full" />
            </div>
            <div className="space-y-2 mt-2">
              <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-700 rounded-full" />
              <div className="h-2 w-5/6 bg-neutral-100 dark:bg-neutral-700 rounded-full" />
            </div>
          </motion.div>
        </div>

        <div className="relative z-20 text-center max-w-4xl px-6">
          <motion.h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-8 leading-[1.1]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            Votre cerveau, <br />
            <span className="relative inline-block">
              libéré.
              <motion.svg className="absolute -bottom-4 left-0 w-full h-6 text-blue-500" viewBox="0 0 200 9" fill="none" xmlns="http://www.w3.org/2000/svg" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.8 }}>
                <path d="M2.00025 7.00002C52.1129 2.56214 149.039 -2.3686 197.996 3.84379" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </motion.svg>
            </span>
          </motion.h1>

          <motion.p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-400 mb-10 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
            L'espace de travail visuel pour les équipes qui préfèrent le chaos aux listes rigides.
            Diagrammes, dessins et conception à la vitesse de la pensée.
          </motion.p>

          <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            <Link to={ctaTo}>
              <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 transition-transform hover:scale-105">
                {isLoggedIn ? "Aller au tableau de bord" : "Commencer — C'est gratuit"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#demo">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900">
                Voir la démo
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="py-12 border-y border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center md:text-left">
            {[
              { value: "10k+", label: "Tableaux créés" },
              { value: "< 50ms", label: "Latence moyenne" },
              { value: "∞", label: "Canvas infini" },
              { value: "0€", label: "Pour commencer" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl font-extrabold text-blue-600">{value}</div>
                <div className="text-sm text-neutral-500 font-medium mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product demo */}
      <section id="demo" className="py-32 px-6 max-w-7xl mx-auto scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Un canvas qui ressemble à votre façon de penser.
            </h2>
            <p className="text-lg text-neutral-500 mb-8 leading-relaxed">
              Dessinez, connectez, organisez. Toolbar flottante, layers, minimap, chat intégré —
              tout ce qu'il faut pour ne jamais perdre le fil de vos idées.
            </p>
            <ul className="space-y-3">
              {["Post-its, formes, flèches et texte libre", "Calques et historique undo/redo", "Chat avec liens vers les éléments"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <CanvasMockup />
          </motion.div>
        </div>
      </section>

      {/* Tools */}
      <section id="features" className="py-32 px-6 bg-white dark:bg-neutral-950 border-y border-neutral-200 dark:border-neutral-800 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Tout ce qu'il faut, rien de superflu</h2>
            <p className="text-xl text-neutral-500">Des outils pensés pour la vitesse, pas pour la complexité.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {([
              { icon: Pencil, label: "Dessin libre", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-600" },
              { icon: MousePointer2, label: "Sélection", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600" },
              { icon: Layers, label: "Calques", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600" },
              { icon: MessageSquare, label: "Chat", color: "bg-pink-100 dark:bg-pink-900/30 text-pink-600" },
              { icon: Undo2, label: "Historique", color: "bg-green-100 dark:bg-green-900/30 text-green-600" },
              { icon: InfinityIcon, label: "Canvas ∞", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700" },
            ] as const).map(({ icon: Icon, label, color }) => (
              <motion.div
                key={label}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                whileHover={{ scale: 1.03 }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-center">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-4">Comment ça marche</h2>
          <p className="text-xl text-neutral-500">Trois étapes. Zéro friction.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-neutral-200 dark:bg-neutral-800" />
          {([
            { step: "01", title: "Créez un tableau", desc: "Inscrivez-vous en 30 secondes et lancez un canvas vierge ou avec un modèle.", rotate: "-rotate-2", bg: "bg-[#FFD02F] text-black" },
            { step: "02", title: "Invitez votre équipe", desc: "Partagez par email. Tout le monde arrive sur le même canvas instantanément.", rotate: "rotate-1", bg: "bg-blue-600 text-white" },
            { step: "03", title: "Pensez en visuel", desc: "Dessinez, discutez, itérez. Vos idées prennent forme en temps réel.", rotate: "-rotate-1", bg: "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700" },
          ] as const).map(({ step, title, desc, rotate, bg }) => (
            <motion.div
              key={step}
              className={`relative p-8 rounded-3xl shadow-xl ${bg} ${rotate}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: parseInt(step) * 0.1 }}
            >
              <div className="text-5xl font-black opacity-20 mb-4">{step}</div>
              <h3 className="text-2xl font-bold mb-3">{title}</h3>
              <p className={`leading-relaxed ${bg.includes("text-black") ? "text-black/70" : bg.includes("text-white") ? "text-blue-100" : "text-neutral-500"}`}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-4">Conçu pour tous les flux de travail</h2>
          <p className="text-xl text-neutral-500">Du brainstorming désordonné aux diagrammes soignés.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {([
            { icon: Brain, bgClass: "bg-orange-100 dark:bg-orange-900/30 text-orange-600", title: "Brainstorming", desc: "Déposez vos idées sur un canvas infini. Groupez, triez et connectez vos pensées sans jamais manquer d'espace." },
            { icon: Code2, bgClass: "bg-purple-100 dark:bg-purple-900/30 text-purple-600", title: "Conception Système", desc: "Cartographiez des architectures complexes avec des notes et des connecteurs. Parfait pour les équipes d'ingénierie." },
            { icon: Rocket, bgClass: "bg-green-100 dark:bg-green-900/30 text-green-600", title: "Planification de Sprint", desc: "Visualisez votre roadmap. Déplacez les tâches et voyez qui travaille sur quoi en temps réel." },
          ] as const).map(({ icon: Icon, bgClass, title, desc }) => (
            <div key={title} className="group p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${bgClass}`}>
                <Icon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{title}</h3>
              <p className="text-neutral-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Deep Dive */}
      <section className="bg-black text-white py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Collaboration temps réel qui fonctionne vraiment.</h2>
              <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
                Plus besoin de rafraîchir. Voyez les curseurs de vos coéquipiers voler sur l'écran.
                Les modifications sont instantanées pour tout le monde.
              </p>
              <ul className="space-y-4">
                {([
                  { icon: Zap, bgClass: "bg-blue-600", text: "Latence ultra-faible (< 50ms)" },
                  { icon: Share2, bgClass: "bg-green-600", text: "Curseurs et présence en direct" },
                  { icon: Users, bgClass: "bg-pink-600", text: "Invitations par email en un clic" },
                ] as const).map(({ icon: Icon, bgClass, text }) => (
                  <li key={text} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${bgClass}`}><Icon className="w-3 h-3" /></div>
                    <span className="font-medium">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative aspect-square rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden p-8 flex flex-col justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#3b82f6_0%,transparent_50%)] opacity-10" />
              <div className="bg-neutral-800 rounded-xl p-4 shadow-xl border border-neutral-700 w-3/4 mx-auto mb-6 transform -rotate-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center font-bold">L</div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-neutral-800 rounded-full" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Léa</div>
                    <div className="text-xs text-green-400">En train d'écrire...</div>
                  </div>
                </div>
                <div className="bg-neutral-700 rounded-lg p-3 text-sm text-neutral-300">On devrait bouger ce bloc vers la gauche, non ?</div>
              </div>
              <div className="bg-neutral-800 rounded-xl p-4 shadow-xl border border-neutral-700 w-3/4 mx-auto transform rotate-3 translate-x-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">T</div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-neutral-800 rounded-full" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Thomas</div>
                    <div className="text-xs text-neutral-400">En ligne</div>
                  </div>
                </div>
                <div className="bg-blue-600 rounded-lg p-3 text-sm text-white">Carrément ! Je m'en occupe.</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
            <div className="order-2 md:order-1 relative aspect-square rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden p-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-[linear-gradient(45deg,#ec4899_0%,transparent_50%)] opacity-10" />
              <div className="w-full h-full border border-neutral-700 rounded-xl bg-neutral-950 relative overflow-hidden">
                <div className="absolute top-4 left-4 w-20 h-12 bg-neutral-800 rounded border border-neutral-700" />
                <div className="absolute bottom-10 left-1/3 w-32 h-32 bg-neutral-800 rounded-full border border-neutral-700" />
                <div className="absolute top-1/4 right-10 w-24 h-40 bg-neutral-800 rounded border border-neutral-700" />
                <div className="absolute top-[20%] left-[25%] w-[40%] h-[30%] border-2 border-blue-500 bg-blue-500/10 rounded shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                  <div className="absolute top-[-20px] left-0 bg-blue-500 text-white text-[10px] px-2 rounded-t">Votre vue</div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Espace infini pour idées infinies.</h2>
              <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
                Ne laissez pas les pages limiter votre réflexion. Notre moteur gère des milliers d'éléments sans ralentir.
              </p>
              <Link to={ctaTo}>
                <Button variant="outline" className="rounded-full border-neutral-700 text-white bg-transparent hover:bg-neutral-800 hover:text-white h-12 px-8">
                  Explorer le Canvas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Ils ont adopté le chaos</h2>
          <p className="text-xl text-neutral-500">Des équipes qui ne reviendront jamais aux slides.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map(({ quote, author, role, color }, i) => (
            <motion.div
              key={author}
              className={`p-8 rounded-3xl shadow-lg ${color} ${i === 1 ? "md:-translate-y-4" : ""}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="text-lg font-medium leading-relaxed mb-6">"{quote}"</p>
              <div>
                <div className="font-bold">{author}</div>
                <div className="text-sm opacity-70">{role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-32 px-6 bg-white dark:bg-neutral-950 border-y border-neutral-200 dark:border-neutral-800 scroll-mt-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Questions fréquentes</h2>
            <p className="text-neutral-500">Tout ce que vous voulez savoir avant de plonger.</p>
          </div>
          <div>
            {FAQ_ITEMS.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tighter">Prêt à vous lancer ?</h2>
            <p className="text-xl text-neutral-500 mb-12">Rejoignez le futur du travail. Pas de carte de crédit requise.</p>
            <Link to={ctaTo}>
              <Button size="lg" className="h-16 px-10 text-xl rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl hover:scale-105 transition-transform">
                Commencer maintenant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-12 bg-white dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <BoardlyBrand size={24} />
          <p className="text-neutral-500 text-sm">© 2026 Boardly. Tous droits réservés.</p>
          <div className="flex gap-6 text-sm font-medium text-neutral-600 dark:text-neutral-400">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-black dark:hover:text-white transition">Twitter</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-black dark:hover:text-white transition">GitHub</a>
            <Link to="/auth/sign-in" className="hover:text-black dark:hover:text-white transition">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

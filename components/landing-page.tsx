"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Layout, MousePointer2, Pencil, Share2, Zap, Brain, Rocket, Code2, Layers, MessageSquare, User } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function LandingPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -150]);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#FDFCF8] dark:bg-[#0A0A0A] text-neutral-900 dark:text-white overflow-hidden font-sans selection:bg-yellow-200 selection:text-black">
      
      {/* Navbar Minimaliste */}
      <nav className="fixed top-0 w-full z-50 px-6 py-6 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight pointer-events-auto">
          <div className="h-8 w-8 bg-black dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-black shadow-xl">
              <Layout className="h-5 w-5" />
          </div>
          Boardly
        </div>
        <div className="flex items-center gap-4 pointer-events-auto">
           {isLoggedIn ? (
               <Link href="/dashboard">
                  <Button className="rounded-full px-6 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                    Tableau de bord
                  </Button>
               </Link>
           ) : (
               <>
                  <Link href="/auth/sign-in" className="text-sm font-semibold hover:opacity-70 transition hidden sm:block">Se connecter</Link>
                  <Link href="/auth/sign-in">
                      <Button className="rounded-full px-6 bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                        Essayer gratuitement
                      </Button>
                  </Link>
               </>
           )}
        </div>
      </nav>

      {/* Hero Section Immersive */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-20">
        
        {/* Animated Grid Background */}
        <div className="absolute inset-0 z-0 opacity-40 dark:opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(#a3a3a3_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)]"></div>
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
                style={{ y: y1, rotate: -5 }}
                className="absolute top-[15%] left-[5%] md:left-[15%] w-48 h-48 bg-[#FFD02F] shadow-xl transform rotate-[-6deg] p-6 font-handwriting text-2xl leading-tight flex items-center justify-center text-center text-black/80"
                initial={{ opacity: 0, scale: 0.8, y: 100 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "backOut" }}
            >
                "Ça claque !" ✨
            </motion.div>

            <motion.div 
                className="absolute top-[25%] right-[10%]"
                animate={{ 
                    x: [0, -100, -50, 0], 
                    y: [0, 50, -20, 0] 
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            >
                <MousePointer2 className="w-6 h-6 text-[#EC4899] fill-[#EC4899]" />
                <div className="ml-4 -mt-4 bg-[#EC4899] text-white text-xs px-2 py-1 rounded-md font-bold">Julie</div>
            </motion.div>

            <motion.div 
                style={{ y: y2, rotate: 5 }}
                className="absolute bottom-[20%] right-[5%] md:right-[15%] w-64 h-auto bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-2xl p-4 flex flex-col gap-3"
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
            >
                <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-700 pb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">TM</div>
                    <div className="flex-1 h-2 bg-neutral-100 rounded-full w-20"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-2 w-full bg-neutral-50 rounded-full"></div>
                    <div className="h-2 w-5/6 bg-neutral-50 rounded-full"></div>
                </div>
            </motion.div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 text-center max-w-4xl px-6">
            <motion.h1 
                className="text-6xl md:text-8xl font-extrabold tracking-tight mb-8 leading-[1.1]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                Votre cerveau, <br/>
                <span className="relative inline-block">
                    libéré.
                    <motion.svg 
                        className="absolute -bottom-4 left-0 w-full h-6 text-blue-500" 
                        viewBox="0 0 200 9" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1, delay: 0.8 }}
                    >
                        <path d="M2.00025 7.00002C52.1129 2.56214 149.039 -2.3686 197.996 3.84379" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </motion.svg>
                </span>
            </motion.h1>

            <motion.p 
                className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-400 mb-10 max-w-2xl mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                L'espace de travail visuel pour les équipes qui préfèrent le chaos aux listes rigides.
                Diagrammes, dessins et conception à la vitesse de la pensée.
            </motion.p>

            <motion.div 
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
            >
                <Link href={isLoggedIn ? "/dashboard" : "/auth/sign-in"}>
                    <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 transition-transform hover:scale-105">
                        {isLoggedIn ? "Aller au tableau de bord" : "Commencer — C'est gratuit"}
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </Link>
            </motion.div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-20">
              <h2 className="text-4xl font-bold mb-4">Conçu pour tous les flux de travail</h2>
              <p className="text-xl text-neutral-500">Du brainstorming désordonné aux diagrammes soignés.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="group p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform">
                      <Brain className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Brainstorming</h3>
                  <p className="text-neutral-500 leading-relaxed">Déposez vos idées sur un canvas infini. Groupez, triez et connectez vos pensées sans jamais manquer d'espace.</p>
              </div>

              <div className="group p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform">
                      <Code2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Conception Système</h3>
                  <p className="text-neutral-500 leading-relaxed">Cartographiez des architectures complexes avec des notes et des connecteurs. Parfait pour les équipes d'ingénierie.</p>
              </div>

              <div className="group p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-600 mb-6 group-hover:scale-110 transition-transform">
                      <Rocket className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Planification de Sprint</h3>
                  <p className="text-neutral-500 leading-relaxed">Visualisez votre roadmap. Déplacez les tâches et voyez qui travaille sur quoi en temps réel.</p>
              </div>
          </div>
      </section>

      {/* Feature Deep Dive - Dark Mode for contrast */}
      <section className="bg-black text-white py-32 px-6">
          <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
                  <div>
                      <h2 className="text-4xl md:text-5xl font-bold mb-6">Collaboration temps réel qui fonctionne vraiment.</h2>
                      <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
                          Plus besoin de rafraîchir. Voyez les curseurs de vos coéquipiers voler sur l'écran.
                          Les modifications sont instantanées pour tout le monde, que vous soyez dans la même pièce ou à l'autre bout du monde.
                      </p>
                      <ul className="space-y-4">
                          <li className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center"><Zap className="w-3 h-3" /></div>
                              <span className="font-medium">Latence ultra-faible (&lt; 50ms)</span>
                          </li>
                          <li className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center"><Share2 className="w-3 h-3" /></div>
                              <span className="font-medium">Curseurs et présence en direct</span>
                          </li>
                      </ul>
                  </div>
                  <div className="relative aspect-square rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden p-8 flex flex-col justify-center">
                        {/* Concrete visual: Active Users List & Chat */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#3b82f6_0%,transparent_50%)] opacity-10"></div>
                        
                        <div className="bg-neutral-800 rounded-xl p-4 shadow-xl border border-neutral-700 w-3/4 mx-auto mb-6 transform -rotate-2">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="relative">
                                    <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center font-bold">L</div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-neutral-800 rounded-full"></div>
                                </div>
                                <div>
                                    <div className="text-sm font-bold">Léa</div>
                                    <div className="text-xs text-green-400">En train d'écrire...</div>
                                </div>
                            </div>
                            <div className="bg-neutral-700 rounded-lg p-3 text-sm text-neutral-300">
                                On devrait bouger ce bloc vers la gauche, non ?
                            </div>
                        </div>

                        <div className="bg-neutral-800 rounded-xl p-4 shadow-xl border border-neutral-700 w-3/4 mx-auto transform rotate-3 translate-x-4">
                             <div className="flex items-center gap-3 mb-3">
                                <div className="relative">
                                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-bold">T</div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-neutral-800 rounded-full"></div>
                                </div>
                                <div>
                                    <div className="text-sm font-bold">Thomas</div>
                                    <div className="text-xs text-neutral-400">En ligne</div>
                                </div>
                            </div>
                            <div className="bg-blue-600 rounded-lg p-3 text-sm text-white">
                                Carrément ! Je m'en occupe.
                            </div>
                        </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
                  <div className="order-2 md:order-1 relative aspect-square rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden p-8 flex items-center justify-center">
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,#ec4899_0%,transparent_50%)] opacity-10"></div>
                        
                        {/* Concrete visual: Mini Map */}
                        <div className="w-full h-full border border-neutral-700 rounded-xl bg-neutral-950 relative overflow-hidden">
                            <div className="absolute top-4 left-4 w-20 h-12 bg-neutral-800 rounded border border-neutral-700"></div>
                            <div className="absolute bottom-10 left-1/3 w-32 h-32 bg-neutral-800 rounded-full border border-neutral-700"></div>
                            <div className="absolute top-1/4 right-10 w-24 h-40 bg-neutral-800 rounded border border-neutral-700"></div>
                            
                            {/* Viewport Rect */}
                            <div className="absolute top-[20%] left-[25%] w-[40%] h-[30%] border-2 border-blue-500 bg-blue-500/10 rounded shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                                <div className="absolute top-[-20px] left-0 bg-blue-500 text-white text-[10px] px-2 rounded-t">Votre vue</div>
                            </div>
                        </div>
                  </div>
                  <div className="order-1 md:order-2">
                      <h2 className="text-4xl md:text-5xl font-bold mb-6">Espace infini pour idées infinies.</h2>
                      <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
                          Ne laissez pas les pages limiter votre réflexion. Notre moteur gère des milliers d'éléments 
                          sans ralentir. Naviguez, zoomez et explorez librement.
                      </p>
                      <Button variant="outline" className="rounded-full border-neutral-700 text-white bg-transparent hover:bg-neutral-800 hover:text-white">
                          Explorer le Canvas
                      </Button>
                  </div>
              </div>
          </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 text-center">
          <div className="max-w-3xl mx-auto">
              <h2 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tighter">Prêt à vous lancer ?</h2>
              <p className="text-xl text-neutral-500 mb-12">
                  Rejoignez le futur du travail. Pas de carte de crédit requise.
              </p>
              <Link href="/auth/sign-in">
                <Button size="lg" className="h-16 px-10 text-xl rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl hover:scale-105 transition-transform">
                    Commencer maintenant
                </Button>
              </Link>
          </div>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-12 bg-white dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 font-bold">
                <div className="h-6 w-6 bg-black dark:bg-white rounded flex items-center justify-center text-white dark:text-black">
                    <Layout className="h-3 w-3" />
                </div>
                Boardly
            </div>
            <p className="text-neutral-500 text-sm">© 2024 Boardly Inc. Tous droits réservés.</p>
            <div className="flex gap-6 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                <a href="#" className="hover:text-black dark:hover:text-white transition">Twitter</a>
                <a href="#" className="hover:text-black dark:hover:text-white transition">GitHub</a>
                <a href="#" className="hover:text-black dark:hover:text-white transition">Conditions</a>
            </div>
        </div>
      </footer>
    </div>
  );
}
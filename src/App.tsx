import { ToastContainer } from 'react-toastify';
import Game from './components/Game.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import PoweredByConvex from './components/PoweredByConvex.tsx';
import DemoControls from './components/DemoControls.tsx';

export default function Home() {
  const isLedgerlyDemo = window.location.pathname === '/demo/ledgerly';
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between font-body game-background">
      <PoweredByConvex />
      <div className="w-full lg:h-screen min-h-screen relative isolate overflow-hidden lg:p-8 shadow-2xl flex flex-col justify-start">
        <h1 className="mx-auto text-4xl p-3 sm:text-8xl lg:text-9xl font-bold font-display leading-none tracking-wide game-title w-full text-left sm:text-center sm:w-auto">
          LaunchTown
        </h1>
        <div className="max-w-xs md:max-w-xl lg:max-w-none mx-auto my-4 text-center text-base sm:text-xl md:text-2xl text-white leading-tight shadow-solid">
          Rehearse your website launch with a living synthetic population.
        </div>
        {isLedgerlyDemo && <DemoControls />}
        <Game />
        <footer className="justify-end bottom-0 left-0 w-full flex items-center mt-4 gap-3 p-6 flex-wrap pointer-events-none">
          <div className="flex gap-4 flex-grow pointer-events-none">
            <FreezeButton />
          </div>
          <span className="text-sm text-white/80">Built on a16z AI Town + Convex</span>
        </footer>
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>
    </main>
  );
}

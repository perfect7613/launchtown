import { ToastContainer } from 'react-toastify';
import Game from './components/Game.tsx';
import Onboarding from './components/Onboarding.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import PoweredByConvex from './components/PoweredByConvex.tsx';
import DemoControls from './components/DemoControls.tsx';
import { LaunchTownProvider, useLaunchTown } from './launchtown/useLaunchTown.tsx';

function Shell() {
  const { product } = useLaunchTown();
  const isLedgerlyDemo = window.location.pathname === '/demo/ledgerly';
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between font-body game-background">
      <PoweredByConvex />
      <div className="w-full lg:h-screen min-h-screen relative isolate overflow-hidden lg:p-8 shadow-2xl flex flex-col justify-start">
        <div className="flex items-baseline justify-center gap-4 flex-wrap p-2">
          <h1
            className={
              'font-bold font-display leading-none tracking-wide game-title ' +
              (product ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-8xl lg:text-9xl p-3')
            }
          >
            LaunchTown
          </h1>
          {!product && (
            <div className="w-full text-center text-base sm:text-xl md:text-2xl text-white leading-tight shadow-solid">
              Rehearse your website launch with a living synthetic population.
            </div>
          )}
        </div>
        {isLedgerlyDemo && <DemoControls />}
        {product ? <Game /> : <Onboarding />}
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

export default function Home() {
  return (
    <LaunchTownProvider>
      <Shell />
    </LaunchTownProvider>
  );
}

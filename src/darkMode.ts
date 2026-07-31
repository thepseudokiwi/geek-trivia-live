export const appDarkKey='nerd-wars-dark-mode';
const legacyHostDarkKey='nerd-wars-host-dark';

export function appDarkEnabled(){return localStorage.getItem(appDarkKey)==='true'||localStorage.getItem(legacyHostDarkKey)==='true'}
export function setAppDarkMode(enabled:boolean){localStorage.setItem(appDarkKey,String(enabled));localStorage.setItem(legacyHostDarkKey,String(enabled));window.dispatchEvent(new CustomEvent('nerd-wars-dark-mode',{detail:enabled}))}
export function toggleAppDarkMode(){const enabled=!appDarkEnabled();setAppDarkMode(enabled);return enabled}

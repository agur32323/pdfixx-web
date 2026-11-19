/** Runs before paint so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var m=JSON.parse(localStorage.getItem("pdfixx:theme")||'"system"');var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

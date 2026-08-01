import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";
import "./estilos/base.css";

// Import com efeito colateral, de propósito: registra o listener de
// `beforeinstallprompt`, que o Chrome dispara logo após processar o manifest —
// antes de qualquer tela lazy existir.
import "./composables/useInstalacao.ts";

createApp(App).use(createPinia()).use(router).mount("#app");

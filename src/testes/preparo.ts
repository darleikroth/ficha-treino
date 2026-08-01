// fake-indexeddb/auto instala indexedDB e IDBKeyRange no escopo global.
// Os dados vivem em memória e sobrevivem a `close()`/`open()`, que é o que
// permite simular reload da página dentro do mesmo processo.
import "fake-indexeddb/auto";

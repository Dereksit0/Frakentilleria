# Skill: crear-test-tdd

Ciclo TDD para cualquier regla del núcleo.

1. Describir la regla en una frase y sus casos límite.
2. Crear `tests/<modulo>.test.ts` con casos que fallen (rojo).
3. Implementar lo mínimo en `src/core/<modulo>.ts` (verde).
4. Refactorizar sin cambiar el comportamiento.
5. Usar RNG con semilla para que las pruebas sean deterministas.

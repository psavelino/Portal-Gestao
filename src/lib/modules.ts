// Registro único dos módulos do portal que entram no controle de permissão.
// Para adicionar um módulo novo: (1) acrescente a chave aqui, (2) acrescente
// a mesma chave no check de `user_module_access.module_key` no schema.sql
// (e rode a migração equivalente no banco em produção), (3) chame
// `hasModuleAccess("chave-nova")` no topo da página do módulo.

export const MODULE_KEYS = ["forecast", "fechamento"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  href: string;
};

export const MODULES: ModuleDef[] = [
  { key: "forecast", label: "Forecast", href: "/forecast" },
  { key: "fechamento", label: "Fechamento de Horas", href: "/fechamento" },
];

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}

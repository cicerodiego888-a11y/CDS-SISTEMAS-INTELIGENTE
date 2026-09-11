# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: bf0ea93
- Build: 2026-09-09T20:06:55.885Z
- Hash app.asar: `df6931378c59e2675bae22a11c52badc30051671e897ba34e962b2df82be8084`
- Origem: instalador-desatualizado
- Data: 2026-09-10T13:50:57.713Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: df6931378c59…
✔ Login
  - user=rc4320_1789048256825 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1789048252889-P
✔ Compras
  - NF-e …00000064 | status=PRONTA_IMPORTACAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=21
✔ Estoque
  - fiscal=6+3 | total=15 UN
✔ MIIP
  - MUC 10×12 → 120 UN (MULTIPLICADOR)
✔ Central Inteligente
  - documento 000064 processado
✔ NFC-e
  - homologação dest.xNome + módulo emissor presente
✔ NF-e
  - autorização cStat=100 | protocolo=123
✔ Relatórios
  - compras=2 fin=21 prod=712
✔ Performance
  - 4.8s | mem 28.7MB | sql=16

## Estatísticas

- Tempo total: 4.8s
- Memória máxima: 28.7 MB
- CPU user: 2078 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**

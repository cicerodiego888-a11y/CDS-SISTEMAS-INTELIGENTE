# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 7c9c571
- Build: 2026-09-08T13:40:43.674Z
- Hash app.asar: `423ec562e00e625771fb3209f0e740f78cdbf5cb4033a9f3ab067441b9490e9d`
- Origem: instalador
- Data: 2026-09-08T13:47:04.740Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador | asar: 423ec562e00e…
✔ Login
  - user=rc4320_1788875224013 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1788875222345-P
✔ Compras
  - NF-e …00000064 | status=PRONTA_IMPORTACAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=20
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
  - compras=1 fin=20 prod=712
✔ Performance
  - 2.4s | mem 28.5MB | sql=16

## Estatísticas

- Tempo total: 2.4s
- Memória máxima: 28.5 MB
- CPU user: 1657 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**

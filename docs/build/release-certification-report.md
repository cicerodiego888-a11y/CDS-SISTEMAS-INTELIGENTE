# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: e5bc961
- Build: 2026-08-11T15:20:33.025Z
- Hash app.asar: `a3964261ae5f4ae677d1356d746b29e182f384ea39956ec72b30afa242276453`
- Origem: instalador-desatualizado
- Data: 2026-08-11T16:36:15.388Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: a3964261ae5f…
✔ Login
  - user=rc4320_1786466174857 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1786466173781-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=43
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
  - compras=1 fin=43 prod=22
✔ Performance
  - 1.6s | mem 29.4MB | sql=16

## Estatísticas

- Tempo total: 1.6s
- Memória máxima: 29.4 MB
- CPU user: 1015 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**

# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: b7a1da8
- Build: 2026-08-21T22:29:35.360Z
- Hash app.asar: `aa90ca45394594faa6e4837b92f054fb1cedf0d4ad620fe07c05e8edfbafe8a1`
- Origem: fonte
- Data: 2026-08-22T18:55:34.632Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: fonte | asar: N/A…
✔ Login
  - user=rc4320_1787424933794 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1787424932914-P
✔ Compras
  - NF-e …00000064 | status=PRONTA_IMPORTACAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=0
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
  - compras=0 fin=0 prod=8
✔ Performance
  - 1.7s | mem 23.6MB | sql=16

## Estatísticas

- Tempo total: 1.7s
- Memória máxima: 23.6 MB
- CPU user: 1063 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**

# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 8c952c1
- Build: 2026-09-03T12:51:45.336Z
- Hash app.asar: `5ed08fc636326afa96df3658fe4696f2a2a358998d78c41ecc7ae631620b7e85`
- Origem: instalador-desatualizado
- Data: 2026-09-03T13:32:21.995Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: 5ed08fc63632…
✔ Login
  - user=rc4320_1788442340886 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1788442339579-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=29
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
  - compras=0 fin=29 prod=227
✔ Performance
  - 2.4s | mem 26.5MB | sql=16

## Estatísticas

- Tempo total: 2.4s
- Memória máxima: 26.5 MB
- CPU user: 1625 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**

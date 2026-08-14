# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: c33f0b7
- Build: 2026-08-13T21:55:04.084Z
- Hash app.asar: `73948acba5595c7d3724e35557e3ed884782905ff25102798e42e822a9573729`
- Origem: instalador-desatualizado
- Data: 2026-08-13T23:38:52.016Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: 73948acba559…
✔ Login
  - user=rc4320_1786664329929 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1786664328295-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=55
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
  - compras=1 fin=55 prod=486
✔ Performance
  - 3.7s | mem 27MB | sql=16

## Estatísticas

- Tempo total: 3.7s
- Memória máxima: 27 MB
- CPU user: 2531 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**

type CategoriaProduto = 'janelas' | 'portas' | 'portoes' | 'basculhantes';

interface ConfigProduto {
  chave: CategoriaProduto;
  nome: string;
  precoM2: number;
  valorSelect: string;
}

interface SimulacaoSalva {
  produtoNome: string;
  precoM2: number;
  largura: number;
  altura: number;
  areaReal: number;
  areaCobrada: number;
  total: number;
  atualizadoEm: string;
}

const WHATSAPP_DISBRAL = '5521988441402';
const STORAGE_CATEGORIA_KEY = 'disbral_categoria_selecionada';
const STORAGE_SIMULACAO_KEY = 'disbral_ultima_simulacao';
const AREA_MINIMA_M2 = 1.0; // Área mínima cobrada em m² (altere para 0 se não quiser mínimo)
const MAX_PARCELAS = 10;

const PRODUTOS_CONFIG: Record<CategoriaProduto, ConfigProduto> = {
  janelas: {
    chave: 'janelas',
    nome: 'Janela',
    precoM2: 450,
    valorSelect: '450',
  },
  portas: {
    chave: 'portas',
    nome: 'Porta',
    precoM2: 580,
    valorSelect: '580',
  },
  portoes: {
    chave: 'portoes',
    nome: 'Portão',
    precoM2: 650,
    valorSelect: '650',
  },
  basculhantes: {
    chave: 'basculhantes',
    nome: 'Basculhante',
    precoM2: 420,
    valorSelect: '420',
  },
};

function formatarMoedaBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function parseMedida(valor: string): number {
  const normalizado = valor.trim().replace(',', '.');
  return parseFloat(normalizado);
}

function salvarCategoria(categoria: CategoriaProduto): void {
  localStorage.setItem(STORAGE_CATEGORIA_KEY, categoria);
}

function obterCategoriaSalva(): CategoriaProduto | null {
  const valor = localStorage.getItem(STORAGE_CATEGORIA_KEY);
  if (valor && valor in PRODUTOS_CONFIG) {
    return valor as CategoriaProduto;
  }
  return null;
}

function salvarSimulacao(simulacao: SimulacaoSalva): void {
  localStorage.setItem(STORAGE_SIMULACAO_KEY, JSON.stringify(simulacao));
}

function obterSimulacaoSalva(): SimulacaoSalva | null {
  const raw = localStorage.getItem(STORAGE_SIMULACAO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SimulacaoSalva;
  } catch {
    return null;
  }
}

/* ===========================
   1. Lógica do Carrossel (Index)
   =========================== */
function iniciarCarrossel(): void {
  const container = document.querySelector('.carrossel-container') as HTMLElement | null;
  const track = document.getElementById('carrossel-track') as HTMLElement | null;
  const btnNext = document.getElementById('btn-next') as HTMLButtonElement | null;
  const btnPrev = document.getElementById('btn-prev') as HTMLButtonElement | null;

  if (!container || !track || !btnNext || !btnPrev) return;

  const cards = Array.from(track.querySelectorAll<HTMLElement>('.produtos-card'));
  if (cards.length === 0) return;

  cards.forEach((card) => {
    const categoria = card.dataset.categoria as CategoriaProduto | undefined;
    if (categoria && categoria in PRODUTOS_CONFIG) {
      card.addEventListener('click', () => salvarCategoria(categoria));
    }
  });

  const getPassoBloco = (): number => {
    const estiloTrack = window.getComputedStyle(track);
    const gap = parseFloat(estiloTrack.columnGap || estiloTrack.gap || '24');
    const larguraCard = cards[0].getBoundingClientRect().width;
    const visiveis = larguraCard > 0 ? Math.max(1, Math.round(track.clientWidth / larguraCard)) : 3;
    return (larguraCard + gap) * visiveis;
  };

  const getMaxScroll = (): number => Math.max(0, track.scrollWidth - track.clientWidth);

  const rolarPara = (novoLeft: number): void => {
    const alvo = Math.max(0, Math.min(getMaxScroll(), novoLeft));
    const snapAnterior = track.style.scrollSnapType;
    track.style.scrollSnapType = 'none';
    track.scrollLeft = alvo;

    window.requestAnimationFrame(() => {
      track.style.scrollSnapType = snapAnterior || 'x mandatory';
      atualizarControles();
    });
  };

  const atualizarControles = (): void => {
    const maxScroll = getMaxScroll();
    const atual = track.scrollLeft;
    btnPrev.disabled = atual <= 2;
    btnNext.disabled = atual >= maxScroll - 2 || maxScroll <= 2;
  };

  btnNext.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    rolarPara(track.scrollLeft + getPassoBloco());
  });

  btnPrev.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    rolarPara(track.scrollLeft - getPassoBloco());
  });

  track.addEventListener('scroll', atualizarControles, { passive: true });
  window.addEventListener('resize', atualizarControles);
  atualizarControles();
}

/* ===========================
   2. Calculadora Sob Medida (Produtos)
   =========================== */
function iniciarCalculadora(): void {
  const selectProduto = document.getElementById('tipo-produto') as HTMLSelectElement | null;
  const inputLargura = document.getElementById('largura') as HTMLInputElement | null;
  const inputAltura = document.getElementById('altura') as HTMLInputElement | null;
  const form = document.getElementById('form-simulador') as HTMLFormElement | null;
  const valorTotalEl = document.getElementById('valor-total') as HTMLElement | null;
  const detalheAreaEl = document.getElementById('detalhe-area') as HTMLElement | null;
  const resultadoBox = document.querySelector('.resultado-box') as HTMLElement | null;

  if (!selectProduto || !inputLargura || !inputAltura || !form || !valorTotalEl || !detalheAreaEl) {
    return;
  }

  // Cria ou seleciona o botão de WhatsApp dentro da caixa de resultado
  let btnWhats = document.getElementById('btn-whatsapp-simulacao') as HTMLButtonElement | null;
  if (resultadoBox && !btnWhats) {
    btnWhats = document.createElement('button');
    btnWhats.type = 'button';
    btnWhats.id = 'btn-whatsapp-simulacao';
    btnWhats.textContent = 'Solicitar este orçamento no WhatsApp';
    btnWhats.style.marginTop = '1rem';
    btnWhats.style.padding = '0.7rem 1.15rem';
    btnWhats.style.border = 'none';
    btnWhats.style.borderRadius = '8px';
    btnWhats.style.backgroundColor = '#16a34a';
    btnWhats.style.color = '#ffffff';
    btnWhats.style.fontWeight = '700';
    btnWhats.style.fontSize = '0.95rem';
    btnWhats.style.cursor = 'pointer';
    btnWhats.style.display = 'none';

    btnWhats.addEventListener('click', () => {
      const simulacao = obterSimulacaoSalva();
      const mensagem = simulacao
        ? `Olá Disbral! Fiz uma simulação no site:\n` +
          `• Produto: ${simulacao.produtoNome}\n` +
          `• Medidas: ${simulacao.largura.toFixed(2)}m x ${simulacao.altura.toFixed(2)}m (${simulacao.areaReal.toFixed(2)} m²)\n` +
          `• Valor estimado: ${formatarMoedaBRL(simulacao.total)}`
        : 'Olá Disbral! Gostaria de solicitar um orçamento sob medida.';

      const url = `https://wa.me/${WHATSAPP_DISBRAL}?text=${encodeURIComponent(mensagem)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    resultadoBox.appendChild(btnWhats);
  }

  const calcular = (exibirAlertaValidacao: boolean): void => {
    const precoM2 = parseFloat(selectProduto.value);
    const largura = parseMedida(inputLargura.value);
    const altura = parseMedida(inputAltura.value);

    // Se algum campo estiver vazio ou inválido
    if (
      Number.isNaN(precoM2) ||
      Number.isNaN(largura) ||
      Number.isNaN(altura) ||
      largura <= 0 ||
      altura <= 0
    ) {
      valorTotalEl.textContent = 'R$ 0,00';
      detalheAreaEl.textContent = exibirAlertaValidacao
        ? 'Por favor, informe largura e altura válidas (maiores que zero).'
        : 'Informe a largura e a altura para simular.';
      if (btnWhats) btnWhats.style.display = 'none';
      return;
    }

    const produtoSelecionado =
      selectProduto.options[selectProduto.selectedIndex]?.text.split(' (')[0] ?? 'Produto';

    const areaReal = largura * altura;
    const areaCobrada = Math.max(AREA_MINIMA_M2, areaReal);
    const total = areaCobrada * precoM2;
    const valorParcela = total / MAX_PARCELAS;

    valorTotalEl.textContent = formatarMoedaBRL(total);

    const avisoMinimo =
      areaReal < AREA_MINIMA_M2 ? ` (mínimo de ${AREA_MINIMA_M2.toFixed(2)} m² aplicado)` : '';

    detalheAreaEl.innerHTML =
      `<strong>${produtoSelecionado}</strong> • Área: ${areaReal.toFixed(2)} m² ` +
      `(${largura.toFixed(2)}m × ${altura.toFixed(2)}m)${avisoMinimo}<br>` +
      `Ou em até ${MAX_PARCELAS}x de <strong>${formatarMoedaBRL(valorParcela)}</strong> sem juros`;

    if (btnWhats) {
      btnWhats.style.display = 'inline-block';
    }

    salvarSimulacao({
      produtoNome: produtoSelecionado,
      precoM2,
      largura,
      altura,
      areaReal,
      areaCobrada,
      total,
      atualizadoEm: new Date().toISOString(),
    });
  };

  // Clique nos cards superiores ("Produtos Tamanho Padrão") pré-seleciona o produto na calculadora
  const cardsCategoria = document.querySelectorAll<HTMLElement>('.card-produto[id]');
  cardsCategoria.forEach((card) => {
    const id = card.id as CategoriaProduto;
    if (id in PRODUTOS_CONFIG) {
      card.addEventListener('click', () => {
        salvarCategoria(id);
        selectProduto.value = PRODUTOS_CONFIG[id].valorSelect;
        calcular(false);
      });
    }
  });

  // Se veio de outra página com uma categoria selecionada
  const categoriaSalva = obterCategoriaSalva();
  if (categoriaSalva) {
    selectProduto.value = PRODUTOS_CONFIG[categoriaSalva].valorSelect;
  }

  // Cálculo automático ao digitar ou mudar o produto
  selectProduto.addEventListener('change', () => calcular(false));
  inputLargura.addEventListener('input', () => calcular(false));
  inputAltura.addEventListener('input', () => calcular(false));

  // Cálculo ao clicar no botão "Calcular Orçamento Estimado"
  form.addEventListener('submit', (event: Event) => {
    event.preventDefault();
    calcular(true);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarCarrossel();
  iniciarCalculadora();
});
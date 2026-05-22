import { rankName, SUIT_NAMES } from './config.js';

// ==================== 指挥官定义 ====================
export const COMMANDERS = {
  novice: {
    name: '新手指挥官',
    icon: '🎴',
    hand: 5, supply: 2, mulligan: 2,
    desc: '标准基础规则，适合入门练习。',
    skillDesc: {
      hearts: '♥️ 补给：抽3张牌',
      diamonds: '♦️ 侦查：翻至多2张暗置牌',
      clubs: '♣️ 强攻：击败1张明置敌人',
      spades: '♠️ 防御：代替手牌进入弃牌堆'
    },
    // 技能执行函数返回true表示技能已完成，false表示进入子模式
    onSkillHearts: (card) => {
      const confirmed = confirm(`是否发动 ♥️ 补给？\n将弃掉物资牌：♥️${rankName(card.rank)}\n效果：从牌库抽3张牌加入手牌。`);
      if (!confirmed) return true; // true=已完成（取消也视为完成当前选择）
      window.useSupplyCard(card, () => {
        const drawn = window.draw(3);
        window.gameState.hand.push(...drawn);
        window.setMessage(`♥️ 补给发动！弃掉♥️${rankName(card.rank)}，抽了 ${drawn.length} 张牌。`);
        window.finishSkill();
      });
      return true;
    },
    onSkillDiamonds: (card) => {
      const confirmed = confirm(`是否发动 ♦️ 侦查？\n将弃掉物资牌：♦️${rankName(card.rank)}\n效果：选择至多2张可选中的暗置敌人牌，将其翻为明置。`);
      if (!confirmed) return true;
      const revealables = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && window.isSelectable(e));
      if (revealables.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♦️ 侦查发动！但没有可选中的暗置牌。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'reveal';
        window.gameState._maxReveal = Math.min(2, revealables.length);
        window.setMessage(`♦️ 侦查发动！点击至多${window.gameState._maxReveal}张可选中的暗置敌人牌将其翻为明置。`);
        window.renderAll();
      });
      return false; // 进入子模式
    },
    onSkillClubs: (card) => {
      const confirmed = confirm(`是否发动 ♣️ 强攻？\n将弃掉物资牌：♣️${rankName(card.rank)}\n效果：选择一个明置的敌人牌，直接击败并获得奖励。`);
      if (!confirmed) return true;
      const attackables = window.gameState.enemies.filter(e => !e.defeated && e.revealed && window.isSelectable(e));
      if (attackables.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♣️ 强攻发动！但没有可击败的明置敌人。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'attack';
        window.setMessage('♣️ 强攻发动！点击一个明置的敌人牌直接击败。');
        window.renderAll();
      });
      return false;
    },
    onSkillSpades: () => {
      alert('♠️ 防御是被动技能：当你有手牌需要进入弃牌堆时，会自动提示是否用♠️物资代替。');
      return true;
    },
    onAttackSuccess: (handCard, enemy) => {
      window.gameState.discard.push(handCard);
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
      window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
      return true; // 已完成
    },
    onAttackFail: (handCard, enemy) => {
      window.setMessage(`💥 攻城失败！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 无法攻克 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。敌人已明置。`);
      window.renderAll();
      const defense = window.gameState.supply.find(c => c.suit === 'spades');
      if (defense) {
        setTimeout(() => window.askDefense(handCard, enemy, defense), 150);
        return false; // 异步处理
      } else {
        window.gameState.discard.push(handCard);
        return true;
      }
    }
  },

  logistics: {
    name: '后勤专家',
    icon: '♥️',
    hand: 5, supply: 2, mulligan: 2,
    desc: '物资充裕时补给更多，擅长持久作战。',
    skillDesc: {
      hearts: '♥️ 临时补给：物资≥3时抽3张，否则抽2张',
      diamonds: '♦️ 优势侦查：手牌≥5时翻2张，否则翻1张',
      clubs: '♣️ 火力压制：击败明置敌人，或弃1张手牌击败暗置敌人',
      spades: '♠️ 攻城增援：攻城成功时，可消耗1张♠️物资抽2张手牌'
    },
    onSkillHearts: (card) => {
      const amount = window.gameState.supply.length >= 3 ? 3 : 2;
      const confirmed = confirm(`是否发动 ♥️ 临时补给？\n将弃掉物资牌：♥️${rankName(card.rank)}\n当前物资${window.gameState.supply.length}张，抽${amount}张牌。`);
      if (!confirmed) return true;
      window.useSupplyCard(card, () => {
        const drawn = window.draw(amount);
        window.gameState.hand.push(...drawn);
        window.setMessage(`♥️ 临时补给发动！抽了 ${drawn.length} 张牌。`);
        window.finishSkill();
      });
      return true;
    },
    onSkillDiamonds: (card) => {
      const amount = window.gameState.hand.length >= 5 ? 2 : 1;
      const confirmed = confirm(`是否发动 ♦️ 优势侦查？\n将弃掉物资牌：♦️${rankName(card.rank)}\n当前手牌${window.gameState.hand.length}张，翻${amount}张暗置牌。`);
      if (!confirmed) return true;
      const revealables = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && window.isSelectable(e));
      if (revealables.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♦️ 侦查发动！但没有可选中的暗置牌。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'reveal';
        window.gameState._maxReveal = Math.min(amount, revealables.length);
        window.setMessage(`♦️ 优势侦查发动！点击至多${window.gameState._maxReveal}张可选中的暗置敌人牌。`);
        window.renderAll();
      });
      return false;
    },
    onSkillClubs: (card) => {
      const confirmed = confirm(`是否发动 ♣️ 火力压制？\n将弃掉物资牌：♣️${rankName(card.rank)}\n效果：击败1张明置敌人；或弃1张手牌击败1张暗置敌人。`);
      if (!confirmed) return true;
      // 检查是否有明置敌人
      const revealed = window.gameState.enemies.filter(e => !e.defeated && e.revealed && window.isSelectable(e));
      if (revealed.length > 0) {
        window.useSupplyCard(card, () => {
          window.gameState.phase = 'skill'; window.gameState.skillMode = 'attack';
          window.setMessage('♣️ 火力压制：点击一个明置的敌人牌直接击败。');
          window.renderAll();
        });
        return false;
      }
      // 没有明置敌人，检查是否可以弃手牌打暗置
      if (window.gameState.hand.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♣️ 火力压制：没有明置敌人，且手牌为空无法攻击暗置敌人。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'assault_dark';
        window.setMessage('♣️ 火力压制：没有明置敌人。请选择一张手牌弃掉，然后点击一个可选中的暗置敌人击败。');
        window.renderAll();
      });
      return false;
    },
    onSkillSpades: () => { alert('♠️ 攻城增援是被动技能：攻城成功时，若有♠️物资可消耗1张抽2张手牌。'); return true; },
    onAttackSuccess: (handCard, enemy) => {
      window.gameState.discard.push(handCard);
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;

      const reinforce = window.gameState.supply.find(c => c.suit === 'spades');
      if (reinforce) {
        window.renderAll();
        setTimeout(() => {
          const useReinforce = confirm(`♠️ 攻城增援：是否消耗♠️${rankName(reinforce.rank)}发动攻城增援，抽2张牌？`);
          if (useReinforce) {
            const idx = window.gameState.supply.findIndex(c => c.id === reinforce.id);
            window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
            const drawn = window.draw(2);
            window.gameState.hand.push(...drawn);
            window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！♠️攻城增援发动，消耗♠️物资，抽了${drawn.length}张牌。`);
          } else {
            window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
          }
          window.finishAttack();
        }, 150);
        return false;
      }

      window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
      return true;
    },
    onAttackFail: (handCard, enemy) => {
      window.setMessage(`💥 攻城失败！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 无法攻克 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。敌人已明置。`);
      window.renderAll();
      window.gameState.discard.push(handCard);
      return true;
    }
  },

  intel: {
    name: '情报专家',
    icon: '♦️',
    hand: 4, supply: 2, mulligan: 2,
    desc: '擅长侦查和窃取资源，渗透打击出其不意。',
    skillDesc: {
      hearts: '♥️ 窃取补给：抽1张，每有1张明置敌人再抽1张',
      diamonds: '♦️ 广域侦查：翻至多3张暗置牌',
      clubs: '♣️ 渗透打击：用明置敌人对另一敌人攻城',
      spades: '♠️ 佯攻：攻城失败时代替手牌，可调换明暗'
    },
    onSkillHearts: (card) => {
      const revealedCount = window.gameState.enemies.filter(e => e.revealed && !e.defeated).length;
      const amount = 1 + revealedCount;
      const confirmed = confirm(`是否发动 ♥️ 窃取补给？\n将弃掉物资牌：♥️${rankName(card.rank)}\n当前有${revealedCount}张明置敌人，共抽${amount}张牌。`);
      if (!confirmed) return true;
      window.useSupplyCard(card, () => {
        const drawn = window.draw(amount);
        window.gameState.hand.push(...drawn);
        window.setMessage(`♥️ 窃取补给！抽了 ${drawn.length} 张牌。`);
        window.finishSkill();
      });
      return true;
    },
    onSkillDiamonds: (card) => {
      const confirmed = confirm(`是否发动 ♦️ 广域侦查？\n将弃掉物资牌：♦️${rankName(card.rank)}\n效果：选择至多3张可选中的暗置敌人牌翻为明置。`);
      if (!confirmed) return true;
      const revealables = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && window.isSelectable(e));
      if (revealables.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♦️ 广域侦查发动！但没有可选中的暗置牌。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'reveal';
        window.gameState._maxReveal = Math.min(3, revealables.length);
        window.setMessage(`♦️ 广域侦查发动！点击至多${window.gameState._maxReveal}张可选中的暗置敌人牌。`);
        window.renderAll();
      });
      return false;
    },
    onSkillClubs: (card) => {
      const confirmed = confirm(`是否发动 ♣️ 渗透打击？\n将弃掉物资牌：♣️${rankName(card.rank)}\n效果：选择一个明置敌人作为"手牌"，对另一个可选中敌人攻城。`);
      if (!confirmed) return true;
      const revealed = window.gameState.enemies.filter(e => !e.defeated && e.revealed && window.isSelectable(e));
      if (revealed.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♣️ 渗透打击：没有可选中的明置敌人。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'infiltrate_pick';
        window.gameState._infiltrateCard = card;
        window.setMessage('♣️ 渗透打击：先选择一个明置敌人作为你的"攻城手牌"。');
        window.renderAll();
      });
      return false;
    },
    onSkillSpades: () => { alert('♠️ 佯攻是被动技能：攻城失败时代替手牌进入弃牌堆，然后可以调换明暗。'); return true; },
    onAttackSuccess: (handCard, enemy) => {
      window.gameState.discard.push(handCard);
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
      window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
      return true;
    },
    onAttackFail: (handCard, enemy) => {
      window.setMessage(`💥 攻城失败！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 无法攻克 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。敌人已明置。`);
      window.renderAll();
      const defense = window.gameState.supply.find(c => c.suit === 'spades');
      if (defense) {
        setTimeout(() => window.askDefenseIntel(handCard, enemy, defense), 150);
        return false;
      } else {
        window.gameState.discard.push(handCard);
        return true;
      }
    }
  },

  tactician: {
    name: '战术大师',
    icon: '♠️',
    hand: 3, supply: 3, mulligan: 2,
    desc: '物资丰富，精于计算，战争艺术变化多端。',
    skillDesc: {
      hearts: '♥️ 战时补给：每有一种花色物资抽1张，或抽2张',
      diamonds: '♦️ 谨慎侦查：翻暗置牌，弃牌堆顶，花色一致可重复',
      clubs: '♣️ 收割：击败明置敌人，可弃掉从牌库抽牌替换物资',
      spades: '♠️ 战争艺术：代替手牌，按物资花色数获得额外效果'
    },
    onSkillHearts: (card) => {
      const uniqueSuits = new Set(window.gameState.supply.map(c => c.suit)).size;
      const confirmed = confirm(`是否发动 ♥️ 战时补给？\n将弃掉物资牌：♥️${rankName(card.rank)}\n当前有${uniqueSuits}种花色物资，可选择：\nA) 抽${uniqueSuits}张牌（按花色）\nB) 抽2张牌`);
      if (!confirmed) return true;
      const choice = prompt('输入 A 或 B 选择效果：');
      const amount = (choice && choice.toUpperCase() === 'A') ? uniqueSuits : 2;
      window.useSupplyCard(card, () => {
        const drawn = window.draw(amount);
        window.gameState.hand.push(...drawn);
        window.setMessage(`♥️ 战时补给！选择了${choice && choice.toUpperCase() === 'A' ? '按花色' : '固定2张'}，抽了${drawn.length}张牌。`);
        window.finishSkill();
      });
      return true;
    },
    onSkillDiamonds: (card) => {
      const confirmed = confirm(`是否发动 ♦️ 谨慎侦查？\n将弃掉物资牌：♦️${rankName(card.rank)}\n效果：选择暗置敌人翻明置，弃牌堆顶一张，花色一致可继续，最后用物资交换最后一次弃牌。`);
      if (!confirmed) return true;
      const revealables = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && window.isSelectable(e));
      if (revealables.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♦️ 谨慎侦查：没有可选中的暗置敌人。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'tactician_scout';
        window.setMessage('♦️ 谨慎侦查：选择一个暗置敌人开始连锁侦查。');
        window.renderAll();
      });
      return false;
    },
    onSkillClubs: (card) => {
      const confirmed = confirm(`是否发动 ♣️ 收割？\n将弃掉物资牌：♣️${rankName(card.rank)}\n效果：击败明置敌人，将其弃掉，从牌库抽一张牌作为物资奖励。`);
      if (!confirmed) return true;
      const attackables = window.gameState.enemies.filter(e => !e.defeated && e.revealed && window.isSelectable(e));
      if (attackables.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♣️ 收割：没有可击败的明置敌人。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'harvest';
        window.setMessage('♣️ 收割：点击一个明置敌人直接击败。');
        window.renderAll();
      });
      return false;
    },
    onSkillSpades: () => { alert('♠️ 战争艺术是被动技能：攻城成功或失败时，可代替手牌进入弃牌堆，根据物资花色数选择额外效果。'); return true; },
    onAttackSuccess: (handCard, enemy) => {
      const defense = window.gameState.supply.find(c => c.suit === 'spades');
      if (defense) {
        setTimeout(() => window.askDefenseTactician(handCard, enemy, defense, true), 150);
        return false;
      }
      window.gameState.discard.push(handCard);
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
      window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
      return true;
    },
    onAttackFail: (handCard, enemy) => {
      window.setMessage(`💥 攻城失败！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 无法攻克 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。敌人已明置。`);
      window.renderAll();
      const defense = window.gameState.supply.find(c => c.suit === 'spades');
      if (defense) {
        setTimeout(() => window.askDefenseTactician(handCard, enemy, defense), 150);
        return false;
      } else {
        window.gameState.discard.push(handCard);
        return true;
      }
    }
  },

  assault: {
    name: '推进之王',
    icon: '♣️',
    hand: 4, supply: 2, mulligan: 2,
    desc: '攻势凌厉，擅长连锁推进和战场扰乱。',
    skillDesc: {
      hearts: '♥️ 紧急补给：手牌≤3时抽3张，否则抽2张',
      diamonds: '♦️ 扰乱侦查：交换敌人位置并翻转明暗',
      clubs: '♣️ 推进：击败明置敌人，可连锁击败新暴露敌人',
      spades: '♠️ 突破战术：攻城成功时代替手牌，可翻一张新敌人'
    },
    onSkillHearts: (card) => {
      const amount = window.gameState.hand.length <= 3 ? 3 : 2;
      const confirmed = confirm(`是否发动 ♥️ 紧急补给？\n将弃掉物资牌：♥️${rankName(card.rank)}\n当前手牌${window.gameState.hand.length}张，抽${amount}张。`);
      if (!confirmed) return true;
      window.useSupplyCard(card, () => {
        const drawn = window.draw(amount);
        window.gameState.hand.push(...drawn);
        window.setMessage(`♥️ 紧急补给！抽了 ${drawn.length} 张牌。`);
        window.finishSkill();
      });
      return true;
    },
    onSkillDiamonds: (card) => {
      const confirmed = confirm(`是否发动 ♦️ 扰乱侦查？\n将弃掉物资牌：♦️${rankName(card.rank)}\n效果：选择一个可选中敌人与被其覆盖的暗置敌人交换位置，然后翻转明暗。若源变暗置，抽1张。`);
      if (!confirmed) return true;
      const selectableEnemies = window.gameState.enemies.filter(e => {
        if (e.defeated || !window.isSelectable(e)) return false;
        return window.gameState.enemies.some(other => other.id !== e.id && !other.defeated && !other.revealed && other.coveredBy.includes(e.id));
      });
      if (selectableEnemies.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♦️ 扰乱侦查：没有可选中且覆盖暗置敌人的牌。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'disrupt';
        window.setMessage('♦️ 扰乱侦查：先选择一个可选中且覆盖暗置敌人的牌。');
        window.renderAll();
      });
      return false;
    },
    onSkillClubs: (card) => {
      const confirmed = confirm(`是否发动 ♣️ 推进？\n将弃掉物资牌：♣️${rankName(card.rank)}\n效果：击败明置敌人，若产生新可选中敌人，可再消耗1张非♣️物资连锁击败（不获得奖励）。`);
      if (!confirmed) return true;
      const attackables = window.gameState.enemies.filter(e => !e.defeated && e.revealed && window.isSelectable(e));
      if (attackables.length === 0) {
        window.useSupplyCard(card, () => { window.setMessage('♣️ 推进：没有可击败的明置敌人。'); window.finishSkill(); });
        return true;
      }
      window.useSupplyCard(card, () => {
        window.gameState.phase = 'skill'; window.gameState.skillMode = 'push';
        window.setMessage('♣️ 推进：点击一个明置敌人直接击败。');
        window.renderAll();
      });
      return false;
    },
    onSkillSpades: () => { alert('♠️ 突破战术是被动技能：攻城成功时代替手牌进入弃牌堆，若产生新可选中敌人可翻一张为明置。'); return true; },
    onAttackSuccess: (handCard, enemy) => {
      const beforeSelectableIds = new Set(window.gameState.enemies.filter(e => !e.defeated && window.isSelectable(e)).map(e => e.id));
      window.gameState.discard.push(handCard);
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
      window.computeCoverage();
      const newSelectable = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && window.isSelectable(e) && !beforeSelectableIds.has(e.id));
      if (newSelectable.length > 0) {
        window.gameState._breakthroughNewIds = newSelectable.map(e => e.id);
        setTimeout(() => {
          const flip = confirm('♠️ 突破战术：击败后产生了新的可选中敌人，是否将其中一张翻为明置？');
          if (flip) {
            window.gameState.phase = 'skill'; window.gameState.skillMode = 'breakthrough_reveal';
            window.gameState._breakthroughCount = 1;
            window.setMessage('♠️ 突破战术：点击一张新产生的可选中暗置敌人将其翻为明置。');
            document.getElementById('skill-section').style.display = 'block';
            window.renderAll();
          } else {
            window.gameState._breakthroughNewIds = undefined;
            window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
            window.finishAttack();
          }
        }, 150);
        return false; // 异步
      }
      window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
      return true;
    },
    onAttackFail: (handCard, enemy) => {
      window.setMessage(`💥 攻城失败！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 无法攻克 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。敌人已明置。`);
      window.renderAll();
      window.gameState.discard.push(handCard);
      return true;
    }
  }
};

// 城防扩展指挥官（预留）
export const DEFENSE_COMMANDERS = {
  blitzkrieg: {
    name: '闪电战专家',
    icon: '⚡',
    hand: 4, supply: 2, mulligan: 2,
    desc: '城防扩展指挥官。时间紧迫时爆发力更强。',
    skillDesc: { hearts: '♥️急速补给', diamonds: '♦️急速侦查', clubs: '♣️突袭', spades: '♠️缓兵之计' },
    // 实现需结合城防系统（时间牌）
    onSkillHearts: (card) => { alert('闪电战专家需要开启城防扩展才能使用。'); return true; },
    onSkillDiamonds: (card) => { alert('闪电战专家需要开启城防扩展才能使用。'); return true; },
    onSkillClubs: (card) => { alert('闪电战专家需要开启城防扩展才能使用。'); return true; },
    onSkillSpades: () => { alert('闪电战专家需要开启城防扩展才能使用。'); return true; },
    onAttackSuccess: (handCard, enemy) => {
      window.gameState.discard.push(handCard);
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
      window.setMessage(`🎉 攻城成功！`);
      return true;
    },
    onAttackFail: (handCard, enemy) => {
      window.setMessage(`💥 攻城失败！敌人已明置。`);
      window.renderAll();
      window.gameState.discard.push(handCard);
      return true;
    }
  },
  attrition: {
    name: '持久战专家',
    icon: '🛡️',
    hand: 4, supply: 3, mulligan: 2,
    desc: '城防扩展指挥官。时间越长资源越丰富。',
    skillDesc: { hearts: '♥️长线补给', diamonds: '♦️地图勘探', clubs: '♣️歼灭', spades: '♠️修整战术' },
    onSkillHearts: (card) => { alert('持久战专家需要开启城防扩展才能使用。'); return true; },
    onSkillDiamonds: (card) => { alert('持久战专家需要开启城防扩展才能使用。'); return true; },
    onSkillClubs: (card) => { alert('持久战专家需要开启城防扩展才能使用。'); return true; },
    onSkillSpades: () => { alert('持久战专家需要开启城防扩展才能使用。'); return true; },
    onAttackSuccess: (handCard, enemy) => {
      window.gameState.discard.push(handCard);
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
      window.setMessage(`🎉 攻城成功！`);
      return true;
    },
    onAttackFail: (handCard, enemy) => {
      window.setMessage(`💥 攻城失败！敌人已明置。`);
      window.renderAll();
      window.gameState.discard.push(handCard);
      return true;
    }
  }
};

export function getCommander() {
  const sc = window.gameState?.selectedCommander;
  return sc ? COMMANDERS[sc] || DEFENSE_COMMANDERS[sc] : null;
}

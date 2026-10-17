import Phaser from 'phaser'
import { EventBus, type HandIcon } from '../EventBus'
import { Player, type StudentId } from '../entities/Player'
import { touchInput, consumeAction } from '../systems/input'

type Interactable = { id: string; label: string; x: number; y: number; radius: number; hand: HandIcon }

const WORLD = { w: 1600, h: 1200 }

// Graybox of Task 1 "Paz y Salvo": the occupied campus. Placeholder shapes only.
const BUILDINGS = [
  { name: 'BIBLIOTECA', x: 120, y: 100, w: 420, h: 260, color: 0x3a4a6b },
  { name: 'BIENESTAR', x: 1060, y: 100, w: 420, h: 260, color: 0x3d6b4a },
  { name: 'TESORERÍA', x: 120, y: 820, w: 420, h: 260, color: 0x6b5a3a },
  { name: 'RECTORÍA', x: 1060, y: 820, w: 420, h: 260, color: 0x6b3a3a },
]

const INTERACTABLES: Interactable[] = [
  { id: 'biblioteca', label: 'Ventanilla de Biblioteca', x: 330, y: 380, radius: 56, hand: 'document' },
  { id: 'bienestar', label: 'Ventanilla de Bienestar', x: 1270, y: 380, radius: 56, hand: 'document' },
  { id: 'tesoreria', label: 'Ventanilla de Tesorería', x: 330, y: 800, radius: 56, hand: 'document' },
  { id: 'asamblea', label: 'Asamblea del paro', x: 800, y: 600, radius: 110, hand: 'open' },
  { id: 'rectoria', label: 'Puerta de la Rectoría', x: 1270, y: 800, radius: 56, hand: 'fist' },
]

export class Campus extends Phaser.Scene {
  private player!: Player
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'action' | 'actionAlt' | 'sneak', Phaser.Input.Keyboard.Key>
  private nearest: Interactable | null = null

  constructor() {
    super('Campus')
  }

  create(data: { student?: StudentId }) {
    Player.createTextures(this)
    this.cameras.main.setBackgroundColor('#1d2030')
    this.physics.world.setBounds(0, 0, WORLD.w, WORLD.h)

    this.drawGround()
    const walls = this.physics.add.staticGroup()
    for (const b of BUILDINGS) {
      const rect = this.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, b.color).setStrokeStyle(4, 0x14161f)
      walls.add(rect)
      this.add.text(b.x + b.w / 2, b.y + b.h / 2, b.name, { fontFamily: 'Impact, sans-serif', fontSize: '34px', color: '#f4efe1' }).setOrigin(0.5)
    }
    this.drawAssembly(walls)

    for (const it of INTERACTABLES) {
      this.add.circle(it.x, it.y, 10, 0xf2b705).setStrokeStyle(3, 0x14161f)
      this.tweens.add({ targets: this.add.circle(it.x, it.y, 16).setStrokeStyle(2, 0xf2b705), scale: 1.8, alpha: 0, duration: 1200, repeat: -1 })
    }

    this.player = new Player(this, 800, 980, data.student ?? 'camila')
    this.player.body.setCollideWorldBounds(true)
    this.physics.add.collider(this.player.body, walls)

    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h)
    this.cameras.main.startFollow(this.player.body, true, 0.12, 0.12)
    this.cameras.main.setZoom(this.scale.width < 700 ? 0.65 : 1)

    const kb = this.input.keyboard!
    const K = Phaser.Input.Keyboard.KeyCodes
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      action: K.SPACE, actionAlt: K.J, sneak: K.SHIFT,
    }) as typeof this.keys

    EventBus.emitEvent('scene:ready', { scene: 'Campus' })
  }

  update() {
    const k = this.keys
    let dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0)
    let dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0)
    if (dx === 0 && dy === 0) {
      dx = touchInput.x
      dy = touchInput.y
    }
    this.player.move(dx, dy, k.sneak.isDown || touchInput.sneak)
    this.player.update()

    this.updateNearest()

    const pressed = Phaser.Input.Keyboard.JustDown(k.action) || Phaser.Input.Keyboard.JustDown(k.actionAlt) || consumeAction()
    if (pressed) {
      this.player.reachOut(this)
      if (this.nearest) EventBus.emitEvent('interact', { id: this.nearest.id })
    }
  }

  // Used by automated playtests to jump between interactables.
  teleport(id: string) {
    const it = INTERACTABLES.find((i) => i.id === id)
    if (it) this.player.body.setPosition(it.x, it.y + 20)
  }

  private updateNearest() {
    const { x, y } = this.player.position
    let best: Interactable | null = null
    let bestDist = Infinity
    for (const it of INTERACTABLES) {
      const d = Phaser.Math.Distance.Between(x, y, it.x, it.y)
      if (d < it.radius && d < bestDist) {
        best = it
        bestDist = d
      }
    }
    if (best !== this.nearest) {
      this.nearest = best
      EventBus.emitEvent('interact:available', best ? { id: best.id, label: best.label, hand: best.hand } : null)
    }
  }

  private drawGround() {
    const g = this.add.graphics()
    g.fillStyle(0x262a3d).fillRect(0, 0, WORLD.w, WORLD.h)
    g.fillStyle(0x30354b)
    for (let x = 0; x < WORLD.w; x += 80) g.fillRect(x, 0, 2, WORLD.h)
    for (let y = 0; y < WORLD.h; y += 80) g.fillRect(0, y, WORLD.w, 2)
    g.fillStyle(0x3a3f57).fillCircle(800, 600, 170)
  }

  private drawAssembly(walls: Phaser.Physics.Arcade.StaticGroup) {
    const banner = this.add.rectangle(800, 470, 260, 44, 0xd7263d).setStrokeStyle(3, 0x14161f)
    walls.add(banner)
    this.add.text(800, 470, '¡PARO INDEFINIDO!', { fontFamily: 'Impact, sans-serif', fontSize: '24px', color: '#f4efe1' }).setOrigin(0.5)
    const crowd = [
      [720, 540], [770, 520], [830, 520], [880, 540], [700, 600], [900, 600], [740, 660], [860, 660],
    ]
    for (const [x, y] of crowd) {
      const npc = this.add.circle(x, y, 15, 0x8a8f9e).setStrokeStyle(3, 0x14161f)
      walls.add(npc)
      this.tweens.add({ targets: npc, y: y - 4, duration: 400 + Math.random() * 300, yoyo: true, repeat: -1 })
    }
  }
}

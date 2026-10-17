import Phaser from 'phaser'

export type StudentId = 'vale' | 'andres' | 'camila'

export const STUDENTS: Record<StudentId, { name: string; shirt: number; hair: number }> = {
  vale: { name: 'Vale', shirt: 0x7c4dff, hair: 0x2b1b12 },
  andres: { name: 'Andrés', shirt: 0xf4f1e8, hair: 0x111111 },
  camila: { name: 'Camila', shirt: 0xd7263d, hair: 0x5a3214 },
}

const SKIN = 0xc98b5e
const OUTLINE = 0x14161f
const WALK_SPEED = 170
const SNEAK_SPEED = 80
const HAND_RADIUS = 9
const HAND_DISTANCE = 22

// Top down student with oversized hands. The body is the physics object;
// the hands are drawn sprites that follow the facing direction.
export class Player {
  readonly body: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private readonly hands: [Phaser.GameObjects.Image, Phaser.GameObjects.Image]
  private facing = new Phaser.Math.Vector2(0, 1)
  private stride = 0
  private reach = 0
  private reachTween?: Phaser.Tweens.Tween

  static createTextures(scene: Phaser.Scene) {
    for (const [id, look] of Object.entries(STUDENTS)) {
      const key = `student-${id}`
      if (scene.textures.exists(key)) continue
      const g = scene.add.graphics()
      g.fillStyle(OUTLINE).fillEllipse(20, 22, 38, 30)
      g.fillStyle(look.shirt).fillEllipse(20, 22, 34, 26)
      g.fillStyle(OUTLINE).fillCircle(20, 18, 13)
      g.fillStyle(look.hair).fillCircle(20, 18, 11)
      g.generateTexture(key, 40, 40)
      g.destroy()
    }
    if (!scene.textures.exists('hand')) {
      const g = scene.add.graphics()
      g.fillStyle(OUTLINE).fillCircle(HAND_RADIUS + 1, HAND_RADIUS + 1, HAND_RADIUS + 1)
      g.fillStyle(SKIN).fillCircle(HAND_RADIUS + 1, HAND_RADIUS + 1, HAND_RADIUS - 1)
      g.generateTexture('hand', HAND_RADIUS * 2 + 2, HAND_RADIUS * 2 + 2)
      g.destroy()
    }
  }

  constructor(scene: Phaser.Scene, x: number, y: number, public student: StudentId) {
    this.body = scene.physics.add.sprite(x, y, `student-${student}`)
    this.body.setCircle(14, 6, 6).setDepth(10)
    this.hands = [scene.add.image(x, y, 'hand').setDepth(11), scene.add.image(x, y, 'hand').setDepth(11)]
  }

  get position() {
    return this.body.body.center
  }

  get facingVector() {
    return this.facing
  }

  move(dx: number, dy: number, sneaking: boolean) {
    const input = new Phaser.Math.Vector2(dx, dy)
    if (input.lengthSq() > 1) input.normalize()
    const speed = sneaking ? SNEAK_SPEED : WALK_SPEED
    this.body.setVelocity(input.x * speed, input.y * speed)
    if (input.lengthSq() > 0.01) {
      this.facing.copy(input).normalize()
      this.body.setRotation(this.facing.angle() - Math.PI / 2)
      this.stride += input.length() * (sneaking ? 0.12 : 0.22)
    }
  }

  // Both hands shoot forward: a shove, a stamp, handing over a document.
  reachOut(scene: Phaser.Scene) {
    if (this.reachTween?.isPlaying()) return
    this.reachTween = scene.tweens.add({
      targets: this,
      reach: 1,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
  }

  update() {
    const { x, y } = this.position
    const side = new Phaser.Math.Vector2(-this.facing.y, this.facing.x)
    const swing = Math.sin(this.stride) * 6
    const forward = HAND_DISTANCE * 0.55 + this.reach * 16
    this.hands.forEach((hand, i) => {
      const sign = i === 0 ? 1 : -1
      const along = forward + sign * swing * (1 - this.reach)
      const spread = (HAND_DISTANCE * 0.75) * (1 - this.reach * 0.6)
      hand.setPosition(x + this.facing.x * along + side.x * spread * sign, y + this.facing.y * along + side.y * spread * sign)
    })
  }

  destroy() {
    this.body.destroy()
    this.hands.forEach((h) => h.destroy())
  }
}

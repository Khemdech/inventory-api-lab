import { Elysia, t } from 'elysia';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// --- CONFIGURATION ---
const connectionString = "postgresql://postgres:HIDDEN_PASSWORD@db.hrznfnylqxwpuaofxqkn.supabase.co:5432/postgres?pgbouncer=true";

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = new Elysia()
  // Lab 1: ดึงข้อมูลสินค้าคงคลัง (Read / GET)
  .get('/inventory', async ({ query }) => {
    const isLowStock = query.low_stock === 'true';

    return await prisma.product.findMany({
      where: isLowStock ? { quantity: { lte: 10 } } : undefined,
      orderBy: { name: 'asc' },
    });
  }, {
    query: t.Object({
      low_stock: t.Optional(t.String())
    })
  })

  // Lab 2: รับเข้าสินค้าใหม่ (Create / POST)
  .post('/inventory', async ({ body }) => {
    return await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        zone: body.zone,
        quantity: body.quantity ?? 0, 
      }
    });
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, error: "ชื่อสินค้าห้ามว่าง" }),
      sku: t.String({ minLength: 1, error: "SKU ห้ามว่าง" }),
      zone: t.String({ minLength: 1, error: "โซนห้ามว่าง" }),
      quantity: t.Optional(t.Number({ default: 0 }))
    })
  })

  // Lab 3: อัปเดตจำนวนสต๊อก (Update / PATCH)
  .patch('/inventory/:id/adjust', async ({ params: { id }, body, set }) => {
    try {
      return await prisma.product.update({
        where: { id },
        data: {
          quantity: {
            increment: body.change 
          }
        }
      });
    } catch (error) {
      set.status = 404;
      return { error: "ไม่พบสินค้าชิ้นนี้ในระบบ" };
    }
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      change: t.Number()
    })
  })

  // Lab 4: ลบรายการสินค้า (Delete / DELETE)
  .delete('/inventory/:id', async ({ params: { id }, set }) => {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { quantity: true }
    });

    if (!product) {
      set.status = 404;
      return { error: "ไม่พบสินค้านี้ในระบบ" };
    }

    if (product.quantity > 0) {
      set.status = 400;
      return { error: "ไม่สามารถลบสินค้าที่ยังมีอยู่ในสต๊อกได้" };
    }


    await prisma.product.delete({ where: { id } });
    return { message: "ลบรายการสินค้าเรียบร้อยแล้ว" };
  }, {
    params: t.Object({ id: t.String() })
  })

  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
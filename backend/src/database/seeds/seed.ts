import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../auth/entities/user.entity';

export async function seedDatabase(dataSource: DataSource): Promise<void> {
  console.log('🌱 Seeding database...');

  const userRepository = dataSource.getRepository(User);

  // Check if admin user already exists
  const existingAdmin = await userRepository.findOne({
    where: { username: 'admin' },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
    return;
  }

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  const admin = userRepository.create({
    username: 'admin',
    passwordHash,
    email: 'admin@example.com',
  });

  await userRepository.save(admin);

  console.log('✅ Admin user created successfully');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('   ⚠️  Please change the password after first login!\n');
}

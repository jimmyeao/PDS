import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from './entities/playlist.entity';
import { PlaylistItem } from './entities/playlist-item.entity';
import { DevicePlaylist } from './entities/device-playlist.entity';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { CreatePlaylistItemDto } from './dto/create-playlist-item.dto';
import { UpdatePlaylistItemDto } from './dto/update-playlist-item.dto';
import { AssignPlaylistDto } from './dto/assign-playlist.dto';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist)
    private playlistRepository: Repository<Playlist>,
    @InjectRepository(PlaylistItem)
    private playlistItemRepository: Repository<PlaylistItem>,
    @InjectRepository(DevicePlaylist)
    private devicePlaylistRepository: Repository<DevicePlaylist>,
  ) {}

  // Playlist CRUD Operations
  async create(createPlaylistDto: CreatePlaylistDto): Promise<Playlist> {
    const playlist = this.playlistRepository.create(createPlaylistDto);
    return this.playlistRepository.save(playlist);
  }

  async findAll(): Promise<Playlist[]> {
    return this.playlistRepository.find({
      relations: ['items', 'items.content', 'devicePlaylists', 'devicePlaylists.device'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Playlist> {
    const playlist = await this.playlistRepository.findOne({
      where: { id },
      relations: ['items', 'items.content', 'devicePlaylists', 'devicePlaylists.device'],
    });

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${id} not found`);
    }

    return playlist;
  }

  async update(id: number, updatePlaylistDto: UpdatePlaylistDto): Promise<Playlist> {
    const playlist = await this.findOne(id);
    Object.assign(playlist, updatePlaylistDto);
    return this.playlistRepository.save(playlist);
  }

  async remove(id: number): Promise<void> {
    const playlist = await this.findOne(id);
    await this.playlistRepository.remove(playlist);
  }

  // Playlist Item Operations
  async createItem(createPlaylistItemDto: CreatePlaylistItemDto): Promise<PlaylistItem> {
    // Verify playlist exists
    await this.findOne(createPlaylistItemDto.playlistId);

    // Convert daysOfWeek array to JSON string for storage
    const itemData = {
      playlistId: createPlaylistItemDto.playlistId,
      contentId: createPlaylistItemDto.contentId,
      displayDuration: createPlaylistItemDto.displayDuration,
      orderIndex: createPlaylistItemDto.orderIndex,
      timeWindowStart: createPlaylistItemDto.timeWindowStart,
      timeWindowEnd: createPlaylistItemDto.timeWindowEnd,
      daysOfWeek: createPlaylistItemDto.daysOfWeek
        ? JSON.stringify(createPlaylistItemDto.daysOfWeek)
        : undefined,
    };

    const item = this.playlistItemRepository.create(itemData);
    return this.playlistItemRepository.save(item);
  }

  async findAllItems(playlistId: number): Promise<PlaylistItem[]> {
    return this.playlistItemRepository.find({
      where: { playlistId },
      relations: ['content'],
      order: { orderIndex: 'ASC' },
    });
  }

  async findOneItem(id: number): Promise<PlaylistItem> {
    const item = await this.playlistItemRepository.findOne({
      where: { id },
      relations: ['content', 'playlist'],
    });

    if (!item) {
      throw new NotFoundException(`Playlist item with ID ${id} not found`);
    }

    return item;
  }

  async updateItem(id: number, updatePlaylistItemDto: UpdatePlaylistItemDto): Promise<PlaylistItem> {
    const item = await this.findOneItem(id);

    // Convert daysOfWeek array to JSON string for storage if provided
    const updateData = {
      ...updatePlaylistItemDto,
      daysOfWeek: updatePlaylistItemDto.daysOfWeek
        ? JSON.stringify(updatePlaylistItemDto.daysOfWeek)
        : item.daysOfWeek,
    };

    Object.assign(item, updateData);
    return this.playlistItemRepository.save(item);
  }

  async removeItem(id: number): Promise<number> {
    const item = await this.findOneItem(id);
    const playlistId = item.playlistId;  // Capture before deletion
    await this.playlistItemRepository.remove(item);
    return playlistId;  // Return so controller can emit events
  }

  // Device Playlist Assignment Operations
  async assignPlaylistToDevice(assignPlaylistDto: AssignPlaylistDto): Promise<DevicePlaylist> {
    const { deviceId, playlistId } = assignPlaylistDto;

    // Check if assignment already exists
    const existing = await this.devicePlaylistRepository.findOne({
      where: { deviceId, playlistId },
    });

    if (existing) {
      throw new BadRequestException('This playlist is already assigned to this device');
    }

    const assignment = this.devicePlaylistRepository.create(assignPlaylistDto);
    return this.devicePlaylistRepository.save(assignment);
  }

  async getDevicePlaylists(deviceId: number): Promise<Playlist[]> {
    const assignments = await this.devicePlaylistRepository.find({
      where: { deviceId },
      relations: ['playlist', 'playlist.items', 'playlist.items.content'],
    });

    return assignments.map(assignment => assignment.playlist);
  }

  async getPlaylistDevices(playlistId: number): Promise<DevicePlaylist[]> {
    return this.devicePlaylistRepository.find({
      where: { playlistId },
      relations: ['device'],
      order: { assignedAt: 'DESC' },
    });
  }

  async unassignPlaylistFromDevice(deviceId: number, playlistId: number): Promise<void> {
    const assignment = await this.devicePlaylistRepository.findOne({
      where: { deviceId, playlistId },
    });

    if (!assignment) {
      throw new NotFoundException('Playlist assignment not found');
    }

    await this.devicePlaylistRepository.remove(assignment);
  }

  async getActivePlaylistByDeviceStringId(deviceStringId: string): Promise<PlaylistItem[]> {
    // First, we need to get the device's numeric ID from its string ID
    // Since we don't have DevicesService injected here, we'll query directly
    const Device = await this.devicePlaylistRepository.manager.query(
      'SELECT id FROM devices WHERE deviceId = ?',
      [deviceStringId]
    );

    if (!Device || Device.length === 0) {
      return [];
    }

    const deviceId = Device[0].id;
    const playlists = await this.getDevicePlaylists(deviceId);

    // Find the active playlist
    const activePlaylist = playlists.find(p => p.isActive);

    if (!activePlaylist || !activePlaylist.items) {
      return [];
    }

    return activePlaylist.items;
  }
}

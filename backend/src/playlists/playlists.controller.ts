import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { CreatePlaylistItemDto } from './dto/create-playlist-item.dto';
import { UpdatePlaylistItemDto } from './dto/update-playlist-item.dto';
import { AssignPlaylistDto } from './dto/assign-playlist.dto';
import { Playlist } from './entities/playlist.entity';
import { PlaylistItem } from './entities/playlist-item.entity';
import { DevicePlaylist } from './entities/device-playlist.entity';
import { WebSocketGatewayService } from '../websocket/websocket.gateway';
import { DevicesService } from '../devices/devices.service';
import { ServerToClientEvent, ContentUpdatePayload } from '@kiosk/shared';

@ApiTags('Playlists')
@ApiBearerAuth()
@Controller('playlists')
export class PlaylistsController {
  private readonly logger = new Logger(PlaylistsController.name);

  constructor(
    private readonly playlistsService: PlaylistsService,
    private readonly websocketGateway: WebSocketGatewayService,
    private readonly devicesService: DevicesService,
  ) {}

  // Playlist Endpoints
  @Post()
  @ApiOperation({ summary: 'Create new playlist' })
  @ApiResponse({ status: 201, description: 'Playlist created successfully' })
  create(@Body() createPlaylistDto: CreatePlaylistDto): Promise<Playlist> {
    return this.playlistsService.create(createPlaylistDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all playlists' })
  @ApiResponse({ status: 200, description: 'Returns all playlists' })
  findAll(): Promise<Playlist[]> {
    return this.playlistsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get playlist by ID' })
  @ApiResponse({ status: 200, description: 'Returns playlist' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Playlist> {
    return this.playlistsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update playlist' })
  @ApiResponse({ status: 200, description: 'Playlist updated successfully' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
  ): Promise<Playlist> {
    return this.playlistsService.update(id, updatePlaylistDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete playlist' })
  @ApiResponse({ status: 200, description: 'Playlist deleted successfully' })
  @ApiResponse({ status: 404, description: 'Playlist not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.playlistsService.remove(id);
    return { message: 'Playlist deleted successfully' };
  }

  // Playlist Item Endpoints
  @Post('items')
  @ApiOperation({ summary: 'Add item to playlist' })
  @ApiResponse({ status: 201, description: 'Playlist item created successfully' })
  createItem(@Body() createPlaylistItemDto: CreatePlaylistItemDto): Promise<PlaylistItem> {
    return this.playlistsService.createItem(createPlaylistItemDto);
  }

  @Get(':playlistId/items')
  @ApiOperation({ summary: 'Get all items for a playlist' })
  @ApiResponse({ status: 200, description: 'Returns playlist items' })
  findAllItems(@Param('playlistId', ParseIntPipe) playlistId: number): Promise<PlaylistItem[]> {
    return this.playlistsService.findAllItems(playlistId);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update playlist item' })
  @ApiResponse({ status: 200, description: 'Playlist item updated successfully' })
  @ApiResponse({ status: 404, description: 'Playlist item not found' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePlaylistItemDto: UpdatePlaylistItemDto,
  ): Promise<PlaylistItem> {
    return this.playlistsService.updateItem(id, updatePlaylistItemDto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete playlist item' })
  @ApiResponse({ status: 200, description: 'Playlist item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Playlist item not found' })
  async removeItem(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    const playlistId = await this.playlistsService.removeItem(id);

    // Send updated playlist to all devices assigned to this playlist
    try {
      const deviceAssignments = await this.playlistsService.getPlaylistDevices(playlistId);

      for (const assignment of deviceAssignments) {
        const device = assignment.device;
        const playlistItems = await this.playlistsService.getActivePlaylistByDeviceStringId(device.deviceId);

        const payload: ContentUpdatePayload = {
          playlistId: playlistItems.length > 0 ? playlistItems[0].playlistId : playlistId,
          items: playlistItems,
        };
        this.websocketGateway.sendToDevice(device.deviceId, ServerToClientEvent.CONTENT_UPDATE, payload);
        this.logger.log(`Sent updated playlist to device ${device.deviceId} after item deletion`);
      }
    } catch (error) {
      this.logger.error(`Failed to send playlist update to devices after item deletion: ${error.message}`);
    }

    return { message: 'Playlist item deleted successfully' };
  }

  // Device Playlist Assignment Endpoints
  @Post('assign')
  @ApiOperation({ summary: 'Assign playlist to device' })
  @ApiResponse({ status: 201, description: 'Playlist assigned successfully' })
  @ApiResponse({ status: 400, description: 'Playlist already assigned to device' })
  async assignToDevice(@Body() assignPlaylistDto: AssignPlaylistDto): Promise<DevicePlaylist> {
    const assignment = await this.playlistsService.assignPlaylistToDevice(assignPlaylistDto);

    // Send playlist to device if it's connected
    try {
      const device = await this.devicesService.findOne(assignPlaylistDto.deviceId);
      const playlistItems = await this.playlistsService.getActivePlaylistByDeviceStringId(device.deviceId);

      if (playlistItems.length > 0) {
        const payload: ContentUpdatePayload = {
          playlistId: playlistItems[0].playlistId,
          items: playlistItems,
        };
        this.websocketGateway.sendToDevice(device.deviceId, ServerToClientEvent.CONTENT_UPDATE, payload);
        this.logger.log(`Sent playlist update to device ${device.deviceId} after assignment`);
      }
    } catch (error) {
      this.logger.error(`Failed to send playlist to device after assignment: ${error.message}`);
    }

    return assignment;
  }

  @Get('device/:deviceId')
  @ApiOperation({ summary: 'Get all playlists for a device' })
  @ApiResponse({ status: 200, description: 'Returns device playlists' })
  getDevicePlaylists(@Param('deviceId', ParseIntPipe) deviceId: number): Promise<Playlist[]> {
    return this.playlistsService.getDevicePlaylists(deviceId);
  }

  @Get(':playlistId/devices')
  @ApiOperation({ summary: 'Get all devices assigned to a playlist' })
  @ApiResponse({ status: 200, description: 'Returns assigned devices' })
  getPlaylistDevices(@Param('playlistId', ParseIntPipe) playlistId: number): Promise<DevicePlaylist[]> {
    return this.playlistsService.getPlaylistDevices(playlistId);
  }

  @Delete('assign/device/:deviceId/playlist/:playlistId')
  @ApiOperation({ summary: 'Unassign playlist from device' })
  @ApiResponse({ status: 200, description: 'Playlist unassigned successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async unassignFromDevice(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Param('playlistId', ParseIntPipe) playlistId: number,
  ): Promise<{ message: string }> {
    await this.playlistsService.unassignPlaylistFromDevice(deviceId, playlistId);

    // Send updated playlist to device (which may be empty now)
    try {
      const device = await this.devicesService.findOne(deviceId);
      const playlistItems = await this.playlistsService.getActivePlaylistByDeviceStringId(device.deviceId);

      // Send the updated playlist (empty if no other playlists assigned)
      const payload: ContentUpdatePayload = {
        playlistId: playlistItems.length > 0 ? playlistItems[0].playlistId : 0,
        items: playlistItems,
      };
      this.websocketGateway.sendToDevice(device.deviceId, ServerToClientEvent.CONTENT_UPDATE, payload);
      this.logger.log(`Sent playlist update to device ${device.deviceId} after unassignment`);
    } catch (error) {
      this.logger.error(`Failed to send playlist to device after unassignment: ${error.message}`);
    }

    return { message: 'Playlist unassigned successfully' };
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'PLANT_MANAGER')
  async findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll(req.user.tenantId, { search, role });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async create(
    @Request() req: { user: { tenantId: string } },
    @Body() body: {
      email: string; name: string; role: string;
      department?: string; password: string;
    },
  ) {
    return this.usersService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; role?: string; department?: string; isActive?: boolean },
  ) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async remove(@Param('id') id: string) {
    await this.usersService.deactivate(id);
    return { message: 'User deactivated' };
  }
}

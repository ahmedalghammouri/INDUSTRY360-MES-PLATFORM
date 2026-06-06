import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HierarchyService } from './hierarchy.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface RequestUser {
  id: string;
  factoryId: string | null;
}

@ApiTags('Hierarchy')
@ApiBearerAuth('JWT-auth')
@Controller('hierarchy')
export class HierarchyController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Get full ISA-95 hierarchy tree' })
  async getTree(@CurrentUser() user: RequestUser) {
    return this.hierarchyService.getHierarchyTree(user.factoryId);
  }

  @Get('factories')
  @ApiOperation({ summary: 'List factories accessible to user' })
  async getFactories(@CurrentUser() user: RequestUser) {
    return this.hierarchyService.getFactories(user.factoryId);
  }

  @Get('machines')
  @ApiOperation({ summary: 'List machines with optional filters' })
  async getMachines(
    @CurrentUser() user: RequestUser,
    @Query('areaId') areaId?: string,
    @Query('lineId') lineId?: string,
    @Query('type') type?: string,
  ) {
    return this.hierarchyService.getMachines(user.factoryId, { areaId, lineId, type });
  }
}

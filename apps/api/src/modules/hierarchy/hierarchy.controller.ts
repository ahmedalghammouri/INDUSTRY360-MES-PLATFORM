import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HierarchyService } from './hierarchy.service';

@ApiTags('Hierarchy')
@ApiBearerAuth('JWT-auth')
@Controller('hierarchy')
export class HierarchyController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Get full ISA-95 hierarchy tree' })
  async getTree(@Request() req: { user: { tenantId: string } }) {
    return this.hierarchyService.getHierarchyTree(req.user.tenantId);
  }

  @Get('sites')
  async getSites(@Request() req: { user: { tenantId: string } }) {
    return this.hierarchyService.getSites(req.user.tenantId);
  }

  @Get('equipment')
  async getEquipment(
    @Request() req: { user: { tenantId: string } },
    @Query('siteId') siteId?: string,
    @Query('areaId') areaId?: string,
    @Query('type') type?: string,
  ) {
    return this.hierarchyService.getEquipment(req.user.tenantId, { siteId, areaId, type });
  }
}

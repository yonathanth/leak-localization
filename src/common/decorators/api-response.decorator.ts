import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: 200,
      description: 'Successfully retrieved paginated results',
      schema: {
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          statusCode: {
            type: 'number',
            example: 200,
          },
          page: {
            type: 'number',
            example: 1,
          },
          limit: {
            type: 'number',
            example: 10,
          },
          total: {
            type: 'number',
            example: 100,
          },
        },
      },
    }),
  );
};


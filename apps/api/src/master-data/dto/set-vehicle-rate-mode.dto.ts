import { IsIn } from 'class-validator';
import { VehicleRateModeSetting } from '../rates.service';

export class SetVehicleRateModeDto {
  @IsIn(['REPLACE', 'ADD']) value!: VehicleRateModeSetting;
}

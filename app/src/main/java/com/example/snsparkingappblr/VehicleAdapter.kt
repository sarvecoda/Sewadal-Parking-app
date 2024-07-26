package com.example.snsparkingappblr

import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.snsparkingappblr.databinding.LiveVehicleFomatLooklikeBinding

class VehicleAdapter(private val vehicleDataList: ArrayList<VehicleData>, private val listener: OnItemClickListener) : RecyclerView.Adapter<VehicleAdapter.MyViewHolder>() {

    class MyViewHolder(private val binding: LiveVehicleFomatLooklikeBinding) : RecyclerView.ViewHolder(binding.root) {
        val liveVehicleMain = binding.liveVehicleMain
        fun bind(vehicleData: VehicleData, listener: OnItemClickListener) {
            binding.liveSlNoLookLike.text = vehicleData.id.toString()
            binding.liveNameLookLike.text = vehicleData.entry1
            binding.liveVehNoLookLike.text = vehicleData.entry2
            binding.liveMobileNoLookLike.text = vehicleData.entry3
            binding.liveModelNameLookLike.text = vehicleData.entry4

            // Add click listeners for individual components
            binding.ivDelete.setOnClickListener {
                listener.deleteButtonOnClick(vehicleData)
            }

            // Add click listener to confirm and call the mobile number
            binding.liveMobileNoLookLike.setOnClickListener {
                listener.onCallButtonClick(binding.root.context, vehicleData)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MyViewHolder {
        val binding = LiveVehicleFomatLooklikeBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return MyViewHolder(binding)
    }

    override fun onBindViewHolder(holder: MyViewHolder, position: Int) {
        val currentRow = vehicleDataList[position]
        holder.bind(currentRow, listener)

        if (position % 2 == 0) {
            holder.liveVehicleMain.setBackgroundColor(ContextCompat.getColor(holder.itemView.context, R.color.khakhi))
        } else {
            holder.liveVehicleMain.setBackgroundColor(ContextCompat.getColor(holder.itemView.context, R.color.skyblue))
        }
    }

    override fun getItemCount(): Int {
        return vehicleDataList.size
    }

    interface OnItemClickListener {
        fun deleteButtonOnClick(vehicleData: VehicleData)
        fun onCallButtonClick(context: Context, vehicleData: VehicleData)
    }
}
